const express = require('express');
const cors = require('cors');
const path = require('path');
const { exec, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── CORS Configuration for Vercel + Render ──────────────────────────────────
const corsOptions = {
    origin: [
        'http://localhost:3000',           // Local dev
        'https://media-dl.vercel.app',     // Vercel frontend
        'https://mediadl.onrender.com',    // Render backend (self)
    ],
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.use(express.json());

// ─── FIXED: Proper server structure with Invidious fallback ─────────────────

// ─── Utility: find yt-dlp binary ─────────────────────────────────────────────
function getYtDlpBinary() { return 'yt-dlp'; }

// ─── Utility: check if ffmpeg is available ────────────────────────────────────
function isFfmpegAvailable() {
    try {
        execSync('ffmpeg -version', { stdio: 'ignore', timeout: 5000 });
        return true;
    } catch {
        return false;
    }
}

// ─── Cookie auth setup ──────────────────────────────────────────────────────────
let COOKIE_FILE = null;

function initCookies() {
    // First, try to use cookies from Downloads folder directly
    const downloadsPath = path.join(os.homedir(), 'Downloads', 'cookies.txt');
    if (fs.existsSync(downloadsPath)) {
        COOKIE_FILE = downloadsPath;
        console.log('✅ Using cookies from:', downloadsPath);
        return;
    }

    // Fallback to env var
    const raw = process.env.YOUTUBE_COOKIES;
    if (!raw) {
        console.log('⚠️  No cookies found (env var or Downloads/cookies.txt)');
        return;
    }
    try {
        let cookieContent;
        try {
            cookieContent = Buffer.from(raw, 'base64').toString('utf8');
            if (!cookieContent.includes('\t') && !cookieContent.startsWith('#')) {
                throw new Error('not base64');
            }
        } catch {
            cookieContent = raw;
        }

        COOKIE_FILE = path.join(os.tmpdir(), `yt_cookies_${crypto.randomBytes(6).toString('hex')}.txt`);
        fs.writeFileSync(COOKIE_FILE, cookieContent, 'utf8');
        console.log('✅ YouTube cookies loaded from YOUTUBE_COOKIES env var.');
    } catch (e) {
        console.error('❌ Failed to write cookie file:', e.message);
    }
}

initCookies();

// ─── Proxy setup ────────────────────────────────────────────────────────────────
let PROXY_URL = null;
function initProxy() {
    const proxy = process.env.YOUTUBE_PROXY || process.env.PROXY;
    if (proxy) {
        PROXY_URL = proxy;
        console.log('✅ Proxy loaded:', proxy.substring(0, 30) + '...');
    } else {
        console.log('⚠️  YOUTUBE_PROXY env var not set — YouTube datacenter IPs may be blocked.');
        console.log('    To fix: Set YOUTUBE_PROXY="http://us-ca.proxymesh.com:31280" on Render');
    }
}
initProxy();

// ─── Utility: detect if error is due to invalid/rotated cookies or bot block ─
function isCookieError(msg) {
    return msg.includes('no longer valid') ||
           msg.includes('cookies are no longer') ||
           msg.includes('Sign in to confirm') ||
           msg.includes('bot') ||
           msg.includes('account has been terminated') ||
           msg.includes('Please sign in');
}

// ─── Player client strategies (tried in order) ────────────────────────────────
// Optimized for speed: only try the fastest, most reliable clients
const PLAYER_CLIENTS = [
    'web',          // Standard web client (most reliable)
    'mweb',         // Mobile web (faster fallback)
];

// ─── Utility: build base yt-dlp flags with player client ─────────────────────
function getBaseFlags(useCookies = true, playerClient = 'web') {
    const isWindows = process.platform === 'win32';
    const flags = [
        '--no-check-certificates',
        // Use Node.js as JavaScript runtime for YouTube signature solving
        '--js-runtimes', 'node',
        // Optimize for speed: faster socket timeout
        '--socket-timeout', '10',
        // Limit retries to speed up failure
        '--retries', '1',
    ];

    // Use proxy if available (residential proxy bypasses YouTube datacenter blocks)
    if (PROXY_URL) {
        // Don't add quotes - yt-dlp handles the URL directly
        flags.push('--proxy', PROXY_URL);
    }

    // Use different player clients to bypass bot detection
    // Valid clients: web, android, ios, mweb, tv (NOT tv_embedded anymore)
    if (isWindows) {
        flags.push(`--extractor-args "youtube:player_client=${playerClient}"`);
    } else {
        flags.push(`--extractor-args 'youtube:player_client=${playerClient}'`);
    }

    // Only use cookies if they exist AND useCookies is true
    if (useCookies && COOKIE_FILE) {
        if (isWindows) {
            flags.push(`--cookies "${COOKIE_FILE}"`);
        } else {
            const safeCookiePath = COOKIE_FILE.replace(/'/g, "'\\''");
            flags.push(`--cookies '${safeCookiePath}'`);
        }
    }
    return flags.join(' ');
}

// ─── Utility: run yt-dlp with multi-strategy fallback ───────────────────────
function runYtDlp(args, timeoutMs = 45000) {
    const bin = getYtDlpBinary();
    const isWindows = process.platform === 'win32';
    const shellOpts = isWindows
        ? { shell: true, maxBuffer: 20 * 1024 * 1024, timeout: timeoutMs }
        : { shell: '/bin/sh', maxBuffer: 20 * 1024 * 1024, timeout: timeoutMs };

    // Build all attempts: prioritize cookies (faster), then fallback
    // OPTIMIZED: Try only the 2 most reliable clients first (web + mweb), then others
    const attempts = [];
    const primaryClients = ['web', 'mweb'];  // Most reliable - try with cookies
    const fallbackClients = ['android', 'ios'];  // Fallback options
    
    // Primary attempts with cookies (fastest)
    for (const client of primaryClients) {
        attempts.push({ client, useCookies: true });
    }
    // Secondary fallback with cookies
    for (const client of fallbackClients) {
        attempts.push({ client, useCookies: true });
    }
    // Only try without cookies if all with-cookies attempts fail
    for (const client of primaryClients) {
        attempts.push({ client, useCookies: false });
    }

    function tryNext(index) {
        if (index >= attempts.length) {
            return Promise.reject(new Error(
                'YouTube is blocking this server\'s IP. Try using a different video source or enable fresh cookies.'
            ));
        }

        const { client, useCookies } = attempts[index];
        const cmd = `${bin} ${getBaseFlags(useCookies, client)} ${args}`;

        return new Promise((resolve, reject) => {
            exec(cmd, shellOpts, (err, stdout, stderr) => {
                if (!err) {
                    console.log(`[yt-dlp] ✅ Success with client=${client} cookies=${useCookies}`);
                    return resolve(stdout.trim());
                }

                const msg = stderr || err.message || '';
                const firstLine = msg.split('\n')[0];
                console.warn(`[yt-dlp] ⚠️  client=${client} cookies=${useCookies} failed: ${firstLine}`);

                // Check if it's a recoverable error
                if (firstLine.includes('ERROR') && !firstLine.includes('Unsupported')) {
                    console.log(`[yt-dlp] → Trying next strategy...`);
                }

                // Try next strategy
                tryNext(index + 1).then(resolve).catch(reject);
            });
        });
    }

    return tryNext(0);
}

// ─── GET /api/health ─────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'MediaDL Server is running' });
});

// ─── DIAGNOSTIC: GET /api/test-ytdlp ─────────────────────────────────────────
app.get('/api/test-ytdlp', (req, res) => {
    const { url } = req.query;
    const testUrl = url || 'https://youtu.be/kPa7bsKwL-c';
    
    const bin = getYtDlpBinary();
    const baseFlags = getBaseFlags(true, 'tv_embedded');
    const cmd = `${bin} ${baseFlags} --dump-json --no-playlist "${testUrl}"`;
    
    console.log('[test-ytdlp] Running command:', cmd.substring(0, 100) + '...');
    
    exec(cmd, { shell: true, maxBuffer: 20 * 1024 * 1024, timeout: 120000 }, (err, stdout, stderr) => {
        if (err) {
            console.log('[test-ytdlp] Error:', err.message);
            res.json({
                success: false,
                command: cmd.substring(0, 200),
                error: err.message,
                stderr: stderr.substring(0, 500)
            });
        } else {
            try {
                const data = JSON.parse(stdout);
                res.json({
                    success: true,
                    title: data.title,
                    duration: data.duration,
                    formats_count: data.formats ? data.formats.length : 0
                });
            } catch (e) {
                res.json({
                    success: false,
                    error: 'Failed to parse JSON response',
                    stderr: stderr.substring(0, 500)
                });
            }
        }
    });
});

// ─── Helper: extract YouTube video ID ──────────────────────────────────────────
function extractVideoId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
        /[a-zA-Z0-9_-]{11}/
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1] && match[1].length === 11) return match[1];
    }
    return null;
}

// ─── GET /api/cookie-status ───────────────────────────────────────────────────
app.get('/api/cookie-status', (req, res) => {
    res.json({
        cookies_loaded: !!COOKIE_FILE,
        cookie_file: COOKIE_FILE ? '[active]' : null,
        hint: COOKIE_FILE
            ? 'YouTube cookies are active. Bot detection should be bypassed.'
            : 'No cookies loaded. Set YOUTUBE_COOKIES env var to fix bot detection.',
    });
});

// ─── GET /api/proxy-status ────────────────────────────────────────────────────
app.get('/api/proxy-status', (req, res) => {
    res.json({
        proxy_active: !!PROXY_URL,
        proxy_url: PROXY_URL ? '[active-residential-proxy]' : null,
        hint: PROXY_URL
            ? 'Residential proxy is active. YouTube datacenter blocks should be bypassed.'
            : 'No proxy loaded. Set YOUTUBE_PROXY env var to bypass YouTube datacenter IP blocks.',
    });
});

// ─── GET /api/check-ytdlp ─────────────────────────────────────────────────────
app.get('/api/check-ytdlp', async (req, res) => {
    try {
        const version = await runYtDlp('--version', 8000);
        const ffmpeg = isFfmpegAvailable();
        res.json({ available: true, version: version.trim(), ffmpeg, cookies: !!COOKIE_FILE });
    } catch {
        res.json({ available: false, error: 'yt-dlp not found in PATH', ffmpeg: false });
    }
});

// ─── GET /api/info?url=<video_url> ────────────────────────────────────────────
app.get('/api/info', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    const ffmpeg = isFfmpegAvailable();

    // Try YouTube first, then fallback to Invidious
    async function tryFetchInfo() {
        try {
            // Try direct YouTube
            const raw = await runYtDlp(`--dump-json --no-playlist "${url}"`);
            return JSON.parse(raw);
        } catch (youtubeErr) {
            console.warn('[api/info] YouTube failed:', youtubeErr.message);
            
            // Fallback: Convert to Invidious URL and try
            const videoId = extractVideoId(url);
            if (videoId) {
                try {
                    console.log('[api/info] Trying Invidious fallback for:', videoId);
                    const invidiousUrl = `https://invidious.jathn.net/watch?v=${videoId}`;
                    const raw = await runYtDlp(`--dump-json --no-playlist "${invidiousUrl}"`);
                    console.log('[api/info] ✅ Invidious success!');
                    return JSON.parse(raw);
                } catch (invErr) {
                    console.warn('[api/info] Invidious also failed:', invErr.message);
                }
            }
            throw youtubeErr;
        }
    }

    try {
        const info = await tryFetchInfo();
        const rawFormats = info.formats || [];

        // ── Build smart merged format list ──────────────────────────────────
        const seen = new Set();
        const formats = [];

        // Helper: find best audio stream (highest tbr)
        const audioStreams = rawFormats.filter(f =>
            f.acodec && f.acodec !== 'none' &&
            (!f.vcodec || f.vcodec === 'none')
        ).sort((a, b) => (b.tbr || 0) - (a.tbr || 0));

        const bestAudioId = audioStreams[0]?.format_id || 'bestaudio';

        // Video streams (video-only or video+audio)
        const videoStreams = rawFormats
            .filter(f => f.vcodec && f.vcodec !== 'none' && f.height)
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
                    label: `${height}p${fps} [${f.ext}] Video only (no audio — install ffmpeg)${size}`,
                    needsMerge: false,
                });
            }
        }

        // ── Preset options at the top ────────────────────────────────────────
        const presets = [];

        presets.push({
            format_id: ffmpeg ? 'bestvideo+bestaudio/best' : 'best',
            ext: 'mp4',
            label: ffmpeg
                ? '⭐ Best Quality (Auto-Merged MP4)'
                : '⭐ Best Quality (MP4)',
            note: 'Recommended',
        });

        if (ffmpeg) {
            presets.push({
                format_id: 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
                ext: 'mp4',
                label: '🎬 1080p HD (Merged MP4)',
                note: '',
            });
            presets.push({
                format_id: 'bestvideo[height<=720]+bestaudio/best[height<=720]',
                ext: 'mp4',
                label: '📺 720p (Merged MP4)',
                note: '',
            });
            presets.push({
                format_id: 'bestvideo[height<=480]+bestaudio/best[height<=480]',
                ext: 'mp4',
                label: '📱 480p (Merged MP4)',
                note: '',
            });
        }

        // Audio-only preset
        presets.push({
            format_id: 'bestaudio/best',
            ext: 'mp3',
            label: '🎵 Audio Only (Best Quality)',
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
    } catch (err) {
        console.error('Info error:', err.message);
        
        // Diagnostic response to help troubleshoot Render deployment
        const diagnostic = {
            error: err.message || 'Failed to fetch video info',
            diagnostics: {
                cookies_set: !!process.env.YOUTUBE_COOKIES,
                proxy_set: !!process.env.YOUTUBE_PROXY,
                ffmpeg_available: ffmpeg,
                platform: process.platform,
            }
        };
        
        // Add hint based on what's missing
        if (!process.env.YOUTUBE_COOKIES) {
            diagnostic.hint = 'YOUTUBE_COOKIES env var not set on Render dashboard';
        } else if (!process.env.YOUTUBE_PROXY) {
            diagnostic.hint = 'YouTube blocked this IP. Set YOUTUBE_PROXY on Render dashboard';
        }
        
        res.status(500).json(diagnostic);
    }
});

// ─── GET /api/download ────────────────────────────────────────────────────────
app.get('/api/download', async (req, res) => {
    const { url, format, title } = req.query;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    const formatId = format || 'bestvideo+bestaudio/best';
    const safeTitle = (title || 'video').replace(/[^a-zA-Z0-9 _\-]/g, '_').slice(0, 80);
    const ffmpeg = isFfmpegAvailable();

    // Determine output format and headers quickly
    const isAudioOnly = formatId === 'bestaudio/best' || formatId.startsWith('bestaudio');
    const ext = isAudioOnly ? 'mp3' : 'mp4';
    const downloadName = `${safeTitle}.${ext}`;
    const mimeType = getMimeType(ext);

    // Set response headers IMMEDIATELY
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Transfer-Encoding', 'binary');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    // Build optimized yt-dlp command for streaming
    const postProcess = isAudioOnly && ffmpeg
        ? '-x --audio-format mp3 --audio-quality 0'
        : ffmpeg ? '--merge-output-format mp4' : '';

    const ytdlpArgs = [
        '-o -',  // Stream to stdout
        `-f "${formatId}"`,
        '--no-playlist',
        '--no-warnings',
        '--quiet',  // Less output = faster
        postProcess,
        `"${url}"`,
    ].filter(Boolean).join(' ');

    console.log(`[download] Streaming: format=${formatId}, url=${url}`);

    // Stream directly from yt-dlp to client (no temp file)
    const child = exec(getYtDlpBinary() + ' ' + ytdlpArgs, async (err) => {
        if (err && !res.headersSent) {
            console.error('[download] Error:', err.message);
            try { res.status(500).json({ error: 'Download failed' }); } catch { }
        }
    });

    child.stdout.pipe(res);
    child.stderr.on('data', (data) => {
        const msg = data.toString();
        if (msg.includes('ERROR')) console.error('[download]', msg);
    });

    res.on('close', () => {
        try { child.kill(); } catch { }
    });
});
    }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

// ─── Start server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🚀 MediaDL Server running at http://localhost:${PORT}`);
    console.log(`🎬 ffmpeg: ${isFfmpegAvailable() ? '✅ available (merging enabled)' : '❌ not found (install ffmpeg to enable merging)'}`);
    console.log(`🔐 Cookies: ${COOKIE_FILE ? '✅ loaded' : '❌ not set'}`);
    console.log(`🌐 Proxy: ${PROXY_URL ? '✅ active' : '❌ not set (YouTube datacenter IPs may be blocked)'}`);
    console.log(`\nEndpoints:`);
    console.log(`  GET /api/health`);
    console.log(`  GET /api/info?url=<video_url>`);
    console.log(`  GET /api/download?url=<video_url>&format=<format_id>`);
    console.log(`  GET /api/check-ytdlp`);
    console.log(`  GET /api/cookie-status`);
    console.log(`  GET /api/proxy-status\n`);
});
