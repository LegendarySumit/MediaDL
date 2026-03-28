const express = require('express');
const cors = require('cors');
const path = require('path');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const pino = require('pino');
const pinoHttp = require('pino-http');
const IORedis = require('ioredis');
const { Queue, Worker, QueueEvents } = require('bullmq');
const cron = require('node-cron');

const app = express();
const PORT = Number(process.env.PORT || 3001);
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
const LOGS_DIR = path.join(__dirname, 'logs');
const QUEUE_NAME = 'media-downloads';
const DOWNLOAD_TTL_MINUTES = Number(process.env.DOWNLOAD_TTL_MINUTES || 60);
const QUEUE_DISABLED = process.env.DISABLE_QUEUE === 'true' || process.env.NODE_ENV === 'test';
const IS_DEV = process.env.NODE_ENV !== 'production';

const CAPTCHA_REQUIRED = process.env.CAPTCHA_REQUIRED === 'true';
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || '';
const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY || '';

fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
fs.mkdirSync(LOGS_DIR, { recursive: true });

const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  pino.multistream([
    { stream: process.stdout },
    { stream: pino.destination({ dest: path.join(LOGS_DIR, 'app.log'), mkdir: true, sync: false }) },
  ])
);

app.use(pinoHttp({ logger }));
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        'script-src': ["'self'", ...(IS_DEV ? ["'unsafe-eval'"] : [])],
      },
    },
  })
);

const PROD_FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'https://media-dl.vercel.app';
const DEV_FRONTEND_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3002',
  'http://127.0.0.1:3003',
];
const ALLOWED_ORIGINS = process.env.NODE_ENV === 'production'
  ? [PROD_FRONTEND_ORIGIN]
  : [...DEV_FRONTEND_ORIGINS, PROD_FRONTEND_ORIGIN];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-captcha-token'],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

const downloadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Download limit exceeded. Try again in one hour.' },
});

app.use('/api', apiLimiter);
app.use('/downloads', express.static(DOWNLOADS_DIR, { maxAge: 0, etag: true }));

function getYtDlpBinary() {
  return 'yt-dlp';
}

function isFfmpegAvailable() {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function splitPool(raw) {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim()).filter(Boolean);
    } catch {
      logger.warn('Failed to parse JSON pool config; falling back to comma split');
    }
  }
  return trimmed.split(',').map((v) => v.trim()).filter(Boolean);
}

function decodeMaybeBase64(raw) {
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    if (decoded.includes('\t') || decoded.startsWith('#')) {
      return decoded;
    }
  } catch {
  }
  return raw;
}

function materializeCookieStringToFile(cookieText, label) {
  const filePath = path.join(os.tmpdir(), `yt_cookie_${label}_${crypto.randomBytes(6).toString('hex')}.txt`);
  fs.writeFileSync(filePath, cookieText, 'utf8');
  return filePath;
}

function buildCookiePool() {
  const pool = [];
  const downloadsPath = path.join(os.homedir(), 'Downloads', 'cookies.txt');
  if (fs.existsSync(downloadsPath)) {
    pool.push(downloadsPath);
  }

  if (process.env.YOUTUBE_COOKIES) {
    try {
      const single = decodeMaybeBase64(process.env.YOUTUBE_COOKIES);
      pool.push(materializeCookieStringToFile(single, 'single'));
    } catch (error) {
      logger.error({ err: error }, 'Failed to materialize YOUTUBE_COOKIES');
    }
  }

  const cookiePoolRaw = splitPool(process.env.YOUTUBE_COOKIES_POOL || '');
  cookiePoolRaw.forEach((entry, index) => {
    try {
      const content = decodeMaybeBase64(entry);
      pool.push(materializeCookieStringToFile(content, `pool_${index}`));
    } catch (error) {
      logger.error({ err: error, index }, 'Failed to materialize cookie pool entry');
    }
  });

  return [...new Set(pool)];
}

function buildProxyPool() {
  const pool = [];
  if (process.env.YOUTUBE_PROXY) pool.push(process.env.YOUTUBE_PROXY);
  if (process.env.PROXY) pool.push(process.env.PROXY);
  const additional = splitPool(process.env.YOUTUBE_PROXY_POOL || '');
  for (const proxy of additional) pool.push(proxy);
  return [...new Set(pool)];
}

const proxyPool = buildProxyPool();
const cookiePool = buildCookiePool();
let proxyIndex = 0;
let cookieIndex = 0;

function getNextProxy() {
  if (!proxyPool.length) return null;
  const proxy = proxyPool[proxyIndex % proxyPool.length];
  proxyIndex += 1;
  return proxy;
}

function getNextCookieFile() {
  if (!cookiePool.length) return null;
  const cookieFile = cookiePool[cookieIndex % cookiePool.length];
  cookieIndex += 1;
  return cookieFile;
}

function alertPoolIssue(source, details) {
  logger.warn({ source, details }, 'Proxy/cookie pool issue detected');
}

function registerExtractionFailure(message) {
  const lowered = String(message || '').toLowerCase();
  if (
    lowered.includes('sign in') ||
    lowered.includes('429') ||
    lowered.includes('too many requests') ||
    lowered.includes('forbidden') ||
    lowered.includes('cookies are no longer')
  ) {
    alertPoolIssue('yt-dlp', message);
  }
}

function detectPlatform(url) {
  if (!url) return 'unknown';
  const urlLower = url.toLowerCase();
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) return 'youtube';
  if (urlLower.includes('instagram.com') || urlLower.includes('instagr.am')) return 'instagram';
  if (urlLower.includes('tiktok.com') || urlLower.includes('vm.tiktok')) return 'tiktok';
  if (urlLower.includes('facebook.com') || urlLower.includes('fb.watch')) return 'facebook';
  return 'other';
}

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function formatDuration(seconds) {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getMimeType(ext) {
  const map = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    mkv: 'video/x-matroska',
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    ogg: 'audio/ogg',
    opus: 'audio/ogg',
  };
  return map[ext] || 'application/octet-stream';
}

async function verifyCaptchaToken(token, remoteIp) {
  if (!CAPTCHA_REQUIRED) {
    return { ok: true, bypassed: true };
  }

  if (!token) {
    return { ok: false, error: 'Captcha token is required' };
  }

  if (TURNSTILE_SECRET_KEY) {
    try {
      const params = new URLSearchParams();
      params.set('secret', TURNSTILE_SECRET_KEY);
      params.set('response', token);
      if (remoteIp) params.set('remoteip', remoteIp);

      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      const data = await response.json();
      if (data.success) {
        return { ok: true, provider: 'turnstile' };
      }
      return { ok: false, error: `Turnstile verification failed: ${(data['error-codes'] || []).join(', ')}` };
    } catch (error) {
      return { ok: false, error: `Turnstile verification error: ${error.message}` };
    }
  }

  if (RECAPTCHA_SECRET_KEY) {
    try {
      const params = new URLSearchParams();
      params.set('secret', RECAPTCHA_SECRET_KEY);
      params.set('response', token);
      if (remoteIp) params.set('remoteip', remoteIp);

      const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      const data = await response.json();
      if (data.success) {
        return { ok: true, provider: 'recaptcha' };
      }
      return { ok: false, error: `reCAPTCHA verification failed: ${(data['error-codes'] || []).join(', ')}` };
    } catch (error) {
      return { ok: false, error: `reCAPTCHA verification error: ${error.message}` };
    }
  }

  return { ok: false, error: 'Captcha is required but server secret key is not configured' };
}

async function requireCaptcha(req, res, next) {
  const token = req.header('x-captcha-token') || req.query.captcha_token || (req.body && req.body.captcha_token);
  const remoteIp = req.ip;
  const result = await verifyCaptchaToken(token, remoteIp);
  if (!result.ok) {
    return res.status(403).json({ error: result.error });
  }
  return next();
}

const redisConfig = process.env.REDIS_URL
  ? process.env.REDIS_URL
  : {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT || 6379),
      password: process.env.REDIS_PASSWORD || undefined,
      db: Number(process.env.REDIS_DB || 0),
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    };

let redisConnection = null;
let downloadQueue = null;
let queueEvents = null;
let worker = null;

const jobState = new Map();
const sseClients = new Map();

function setJobState(jobId, patch) {
  const current = jobState.get(jobId) || {
    jobId,
    status: 'queued',
    progress: 0,
    message: 'Queued',
    createdAt: Date.now(),
  };
  const next = { ...current, ...patch, updatedAt: Date.now() };
  jobState.set(jobId, next);
  return next;
}

function sendSseEvent(jobId, payload) {
  const clients = sseClients.get(jobId);
  if (!clients || clients.size === 0) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const client of clients) {
    try {
      client.write(data);
    } catch {
    }
  }
}

function emitJobUpdate(jobId, patch) {
  const state = setJobState(jobId, patch);
  sendSseEvent(jobId, state);
  return state;
}

function getAttemptConfigs() {
  const attempts = [];
  const clients = ['web', 'mweb', 'android', 'ios'];
  for (let i = 0; i < clients.length; i += 1) {
    attempts.push({
      playerClient: clients[i],
      proxy: getNextProxy(),
      cookieFile: getNextCookieFile(),
    });
  }
  return attempts;
}

function buildYtArgs(base, options) {
  const args = [
    '--no-check-certificates',
    '--js-runtimes', 'node',
    '--socket-timeout', '10',
    '--retries', '1',
    '--extractor-args', `youtube:player_client=${options.playerClient || 'web'}`,
    ...base,
  ];

  if (options.proxy) {
    args.push('--proxy', options.proxy);
  }
  if (options.cookieFile) {
    args.push('--cookies', options.cookieFile);
  }

  return args;
}

async function runYtDlp(extraArgs, timeoutMs = 45000) {
  const attempts = getAttemptConfigs();
  let lastErr = 'Unknown extraction error';

  for (const attempt of attempts) {
    const args = buildYtArgs(extraArgs, attempt);
    const output = await new Promise((resolve) => {
      const child = spawn(getYtDlpBinary(), args, { stdio: ['ignore', 'pipe', 'pipe'], shell: false });
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        try { child.kill('SIGKILL'); } catch { }
      }, timeoutMs);

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        resolve({ ok: false, message: err.message || 'Spawn error' });
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (!timedOut && code === 0) {
          resolve({ ok: true, stdout });
          return;
        }
        const msg = timedOut ? `yt-dlp timed out after ${timeoutMs}ms` : (stderr || `yt-dlp exited with code ${code}`);
        resolve({ ok: false, message: msg });
      });
    });

    if (output.ok) {
      logger.info({ playerClient: attempt.playerClient }, 'yt-dlp command succeeded');
      return output.stdout.trim();
    }

    lastErr = output.message;
    registerExtractionFailure(output.message);
    logger.warn({
      playerClient: attempt.playerClient,
      hasProxy: Boolean(attempt.proxy),
      hasCookie: Boolean(attempt.cookieFile),
      message: output.message.split('\n')[0],
    }, 'yt-dlp attempt failed; trying next strategy');
  }

  throw new Error(lastErr);
}

async function processDownloadJob(job) {
  const { url, formatId, title } = job.data;
  const ffmpeg = isFfmpegAvailable();
  const safeTitle = (title || 'video').replace(/[^a-zA-Z0-9 _\-]/g, '_').slice(0, 80);
  const isAudioOnly = formatId === 'bestaudio/best' || String(formatId || '').startsWith('bestaudio');
  const desiredExt = isAudioOnly ? 'mp3' : 'mp4';

  emitJobUpdate(job.id, {
    status: 'processing',
    progress: 0,
    message: 'Preparing downloader',
    title: safeTitle,
  });

  const outputTemplate = path.join(DOWNLOADS_DIR, `${job.id}-%(title).60s.%(ext)s`);
  const attempts = getAttemptConfigs();
  let lastError = 'Download failed';

  for (let attemptNo = 0; attemptNo < attempts.length; attemptNo += 1) {
    const attempt = attempts[attemptNo];
    const args = buildYtArgs([
      '--newline',
      '--no-playlist',
      '--no-warnings',
      '--progress',
      '-f', formatId,
      '-o', outputTemplate,
    ], attempt);

    if (isAudioOnly && ffmpeg) {
      args.push('-x', '--audio-format', 'mp3', '--audio-quality', '0');
    } else if (ffmpeg) {
      args.push('--merge-output-format', 'mp4');
    }

    args.push(url);

    emitJobUpdate(job.id, {
      status: 'processing',
      message: `Downloading... attempt ${attemptNo + 1}/${attempts.length}`,
    });

    const result = await new Promise((resolve) => {
      const child = spawn(getYtDlpBinary(), args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
      });

      let stderrBuffer = '';
      let resolvedPath = null;
      let lastPercent = 0;

      const updateProgressFromChunk = (rawChunk) => {
        const lines = rawChunk.replace(/\r/g, '\n').split('\n');
        for (const line of lines) {
          if (!line) continue;
          const percentMatch = line.match(/(\d+(?:\.\d+)?)%/);
          if (percentMatch) {
            const value = Math.max(0, Math.min(99, Math.floor(Number(percentMatch[1]))));
            if (value > lastPercent) {
              lastPercent = value;
              emitJobUpdate(job.id, {
                status: 'processing',
                progress: value,
                message: `Downloading ${value}%`,
              });
              try {
                job.updateProgress(value);
              } catch {
              }
            }
          }

          const destinationMatch = line.match(/Destination:\s+(.+)$/i);
          if (destinationMatch && destinationMatch[1]) {
            resolvedPath = destinationMatch[1].trim();
          }
        }
      };

      child.stdout.on('data', (chunk) => {
        updateProgressFromChunk(chunk.toString());
      });

      child.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        stderrBuffer += text;
        updateProgressFromChunk(text);
      });

      child.on('error', (err) => {
        resolve({ ok: false, error: err.message, filePath: resolvedPath });
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ ok: true, filePath: resolvedPath, stderr: stderrBuffer });
          return;
        }
        resolve({ ok: false, error: stderrBuffer || `yt-dlp exited with code ${code}`, filePath: resolvedPath });
      });
    });

    if (result.ok) {
      let finalPath = result.filePath;
      if (!finalPath || !fs.existsSync(finalPath)) {
        const candidates = fs
          .readdirSync(DOWNLOADS_DIR)
          .filter((name) => name.startsWith(String(job.id)))
          .map((name) => path.join(DOWNLOADS_DIR, name))
          .filter((candidatePath) => fs.existsSync(candidatePath));
        finalPath = candidates.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] || null;
      }

      if (!finalPath) {
        throw new Error('Download finished but output file was not found');
      }

      const fileName = path.basename(finalPath);
      emitJobUpdate(job.id, {
        status: 'completed',
        progress: 100,
        message: 'Download ready',
        filePath: finalPath,
        fileName,
        fallbackUrl: `/downloads/${encodeURIComponent(fileName)}`,
        mimeType: getMimeType(path.extname(finalPath).replace('.', '') || desiredExt),
        completedAt: Date.now(),
      });
      try {
        job.updateProgress(100);
      } catch {
      }
      return { fileName };
    }

    lastError = result.error || 'Unknown download error';
    registerExtractionFailure(lastError);
    logger.warn({
      jobId: job.id,
      attempt: attemptNo + 1,
      hasProxy: Boolean(attempt.proxy),
      hasCookie: Boolean(attempt.cookieFile),
      error: String(lastError).split('\n')[0],
    }, 'Download attempt failed');
  }

  emitJobUpdate(job.id, {
    status: 'failed',
    message: String(lastError).split('\n')[0],
    error: String(lastError),
    completedAt: Date.now(),
  });

  throw new Error(lastError);
}

function initQueue() {
  if (QUEUE_DISABLED) {
    logger.warn('Queue initialization is disabled by environment');
    return;
  }

  redisConnection = new IORedis(redisConfig);
  redisConnection.on('error', (err) => logger.error({ err }, 'Redis connection error'));

  downloadQueue = new Queue(QUEUE_NAME, { connection: redisConnection });
  queueEvents = new QueueEvents(QUEUE_NAME, { connection: redisConnection });

  worker = new Worker(
    QUEUE_NAME,
    async (job) => processDownloadJob(job),
    { connection: redisConnection, concurrency: Number(process.env.DOWNLOAD_WORKER_CONCURRENCY || 2) }
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Download job completed');
  });

  worker.on('failed', (job, err) => {
    const jobId = job ? job.id : 'unknown';
    logger.error({ jobId, err }, 'Download job failed');
    emitJobUpdate(jobId, {
      status: 'failed',
      message: err.message || 'Job failed',
      error: err.message || 'Job failed',
      completedAt: Date.now(),
    });
  });

  queueEvents.on('error', (err) => {
    logger.error({ err }, 'Queue events error');
  });
}

function cleanupOldDownloads() {
  const cutoff = Date.now() - (DOWNLOAD_TTL_MINUTES * 60 * 1000);
  let removed = 0;

  const files = fs.readdirSync(DOWNLOADS_DIR);
  for (const name of files) {
    const filePath = path.join(DOWNLOADS_DIR, name);
    try {
      const stat = fs.statSync(filePath);
      if (stat.isFile() && stat.mtimeMs < cutoff) {
        fs.unlinkSync(filePath);
        removed += 1;
      }
    } catch {
    }
  }

  for (const [jobId, state] of jobState.entries()) {
    if (state.updatedAt && state.updatedAt < cutoff) {
      jobState.delete(jobId);
    }
  }

  if (removed > 0) {
    logger.info({ removed }, 'Auto-cleanup removed expired downloads');
  }
}

cron.schedule('*/10 * * * *', cleanupOldDownloads);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'MediaDL Server is running',
    queueEnabled: !QUEUE_DISABLED,
    captchaRequired: CAPTCHA_REQUIRED,
  });
});

app.get('/api/check-ytdlp', async (req, res) => {
  try {
    const version = await runYtDlp(['--version'], 8000);
    const ffmpeg = isFfmpegAvailable();
    res.json({
      available: true,
      version: version.trim(),
      ffmpeg,
      cookiesPoolSize: cookiePool.length,
      proxyPoolSize: proxyPool.length,
      queue: QUEUE_NAME,
    });
  } catch (error) {
    res.json({ available: false, error: error.message, ffmpeg: false });
  }
});

app.get('/api/cookie-status', (req, res) => {
  res.json({
    cookies_loaded: cookiePool.length > 0,
    cookies_pool_size: cookiePool.length,
    hint: cookiePool.length > 0
      ? 'Cookie pool is active for rotation'
      : 'No cookies loaded. Set YOUTUBE_COOKIES or YOUTUBE_COOKIES_POOL',
  });
});

app.get('/api/proxy-status', (req, res) => {
  res.json({
    proxy_active: proxyPool.length > 0,
    proxy_pool_size: proxyPool.length,
    hint: proxyPool.length > 0
      ? 'Proxy pool is active for rotation'
      : 'No proxy pool configured. Set YOUTUBE_PROXY or YOUTUBE_PROXY_POOL',
  });
});

app.get('/api/info', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  const ffmpeg = isFfmpegAvailable();
  const platform = detectPlatform(url);

  try {
    const raw = await runYtDlp(['--dump-json', '--no-playlist', url]);
    const info = JSON.parse(raw);
    const rawFormats = info.formats || [];

    const seen = new Set();
    const formats = [];

    const audioStreams = rawFormats
      .filter((f) => f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none'))
      .sort((a, b) => (b.tbr || 0) - (a.tbr || 0));

    const bestAudioId = audioStreams[0] ? audioStreams[0].format_id : 'bestaudio';

    const videoStreams = rawFormats
      .filter((f) => f.vcodec && f.vcodec !== 'none' && f.height)
      .sort((a, b) => (b.height || 0) - (a.height || 0));

    for (const f of videoStreams) {
      const height = f.height || 0;
      const key = `${height}p_${f.ext}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const hasAudio = f.acodec && f.acodec !== 'none';
      const fps = f.fps ? ` ${Math.round(f.fps)}fps` : '';
      const size = f.filesize ? ` (~${formatBytes(f.filesize)})` : '';

      if (hasAudio) {
        formats.push({
          format_id: f.format_id,
          ext: f.ext,
          height,
          label: `${height}p${fps} [${f.ext}] Video+Audio${size}`,
          needsMerge: false,
        });
      } else if (ffmpeg) {
        formats.push({
          format_id: `${f.format_id}+${bestAudioId}`,
          ext: 'mp4',
          height,
          label: `${height}p${fps} [mp4] Merged HD${size}`,
          needsMerge: true,
        });
      } else {
        formats.push({
          format_id: f.format_id,
          ext: f.ext,
          height,
          label: `${height}p${fps} [${f.ext}] Video only (no audio - install ffmpeg)${size}`,
          needsMerge: false,
        });
      }
    }

    const presets = [];
    presets.push({
      format_id: ffmpeg ? 'bestvideo+bestaudio/best' : 'best',
      ext: 'mp4',
      label: ffmpeg ? 'Best Quality (Auto-Merged MP4)' : 'Best Quality (MP4)',
      note: 'Recommended',
    });

    if (ffmpeg) {
      presets.push({
        format_id: 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
        ext: 'mp4',
        label: '1080p HD (Merged MP4)',
        note: '',
      });
      presets.push({
        format_id: 'bestvideo[height<=720]+bestaudio/best[height<=720]',
        ext: 'mp4',
        label: '720p (Merged MP4)',
        note: '',
      });
      presets.push({
        format_id: 'bestvideo[height<=480]+bestaudio/best[height<=480]',
        ext: 'mp4',
        label: '480p (Merged MP4)',
        note: '',
      });
    }

    presets.push({
      format_id: 'bestaudio/best',
      ext: 'mp3',
      label: 'Audio Only (Best Quality)',
      note: 'Audio only',
    });

    res.json({
      title: info.title,
      thumbnail: info.thumbnail,
      duration: info.duration,
      duration_string: info.duration_string || formatDuration(info.duration),
      uploader: info.uploader || info.channel || 'Unknown',
      view_count: info.view_count,
      like_count: info.like_count,
      description: info.description ? info.description.slice(0, 300) : '',
      webpage_url: info.webpage_url || url,
      extractor: info.extractor_key || info.extractor || 'Unknown',
      ffmpeg,
      formats: [...presets, ...formats.slice(0, 18)],
    });
  } catch (error) {
    logger.error({ err: error, platform }, 'Failed to fetch media info');
    res.status(500).json({
      error: error.message || `Failed to fetch ${platform} info`,
      platform,
      diagnostics: {
        cookies_pool_size: cookiePool.length,
        proxy_pool_size: proxyPool.length,
        ffmpeg_available: ffmpeg,
      },
    });
  }
});

app.post('/api/jobs', downloadLimiter, requireCaptcha, async (req, res) => {
  const { url, format, title } = req.body || {};
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const formatId = format || 'bestvideo+bestaudio/best';
  const safeTitle = (title || 'video').replace(/[^a-zA-Z0-9 _\-]/g, '_').slice(0, 80);

  if (QUEUE_DISABLED || !downloadQueue) {
    const jobId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const state = setJobState(jobId, {
      status: 'queued',
      progress: 0,
      message: 'Queued for processing',
      title: safeTitle,
      formatId,
      mode: 'direct',
    });

    setImmediate(async () => {
      try {
        await processDownloadJob({
          id: jobId,
          data: { url, formatId, title: safeTitle },
          updateProgress: async () => {},
        });
      } catch (error) {
        logger.error({ err: error, jobId }, 'Direct download job failed');
        emitJobUpdate(jobId, {
          status: 'failed',
          message: error.message || 'Download failed',
          error: error.message || 'Download failed',
          completedAt: Date.now(),
        });
      }
    });

    return res.json({ job_id: jobId, ...state });
  }

  try {
    const job = await downloadQueue.add(
      'download',
      { url, formatId, title: safeTitle },
      {
        attempts: Number(process.env.DOWNLOAD_JOB_ATTEMPTS || 3),
        removeOnComplete: false,
        removeOnFail: false,
        backoff: { type: 'exponential', delay: 2000 },
      }
    );

    const state = setJobState(job.id, {
      status: 'queued',
      progress: 0,
      message: 'Queued for processing',
      title: safeTitle,
      formatId,
    });

    res.json({ job_id: job.id, ...state });
  } catch (error) {
    logger.error({ err: error }, 'Failed to enqueue download job');
    res.status(500).json({ error: 'Failed to create download job' });
  }
});

app.get('/api/jobs/:id', async (req, res) => {
  const { id } = req.params;
  const state = jobState.get(id);

  if (!state) {
    if (QUEUE_DISABLED || !downloadQueue) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const queueJob = await downloadQueue.getJob(id);
    if (!queueJob) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const status = await queueJob.getState();
    return res.json({
      jobId: id,
      status,
      progress: Number(queueJob.progress || 0),
      message: status,
    });
  }

  return res.json(state);
});

app.get('/api/progress', (req, res) => {
  const jobId = req.query.id;
  if (!jobId) {
    return res.status(400).json({ error: 'id query parameter is required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  if (!sseClients.has(jobId)) {
    sseClients.set(jobId, new Set());
  }

  const clients = sseClients.get(jobId);
  clients.add(res);

  const initialState = jobState.get(jobId) || {
    jobId,
    status: 'queued',
    progress: 0,
    message: 'Waiting for updates',
  };

  res.write(`data: ${JSON.stringify(initialState)}\n\n`);

  const keepAlive = setInterval(() => {
    try {
      res.write(': keep-alive\n\n');
    } catch {
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(keepAlive);
    const set = sseClients.get(jobId);
    if (set) {
      set.delete(res);
      if (set.size === 0) sseClients.delete(jobId);
    }
  });
});

app.get('/api/jobs/:id/file', (req, res) => {
  const { id } = req.params;
  const state = jobState.get(id);
  if (!state) {
    return res.status(404).json({ error: 'Job not found' });
  }

  if (state.status !== 'completed' || !state.filePath) {
    return res.status(409).json({ error: 'File is not ready yet' });
  }

  if (!fs.existsSync(state.filePath)) {
    return res.status(410).json({ error: 'File expired or missing' });
  }

  const fileName = state.fileName || path.basename(state.filePath);
  const ext = path.extname(fileName).replace('.', '');
  res.setHeader('Content-Type', state.mimeType || getMimeType(ext));
  return res.download(state.filePath, fileName);
});

let server = null;

function startServer() {
  initQueue();
  server = app.listen(PORT, () => {
    logger.info({
      port: PORT,
      ffmpeg: isFfmpegAvailable(),
      cookiePoolSize: cookiePool.length,
      proxyPoolSize: proxyPool.length,
      queueEnabled: !QUEUE_DISABLED,
      captchaRequired: CAPTCHA_REQUIRED,
    }, 'MediaDL server started');
  });
  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  startServer,
  detectPlatform,
  formatDuration,
  verifyCaptchaToken,
};
