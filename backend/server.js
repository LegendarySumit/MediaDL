const express = require('express');
const cors = require('cors');
const path = require('path');
const { exec, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

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

// ─── Cookie auth setup ────────────────────────────────────────────────────────
let COOKIE_FILE = null;

function initCookies() {
    const raw = process.env.YOUTUBE_COOKIES;
    if (!raw) {
        console.log('⚠️  YOUTUBE_COOKIES env var not set — running cookie-free mode.');
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
        console.log('✅ YouTube cookies loaded.');
    } catch (e) {
        console.error('❌ Failed to write cookie file:', e.message);
    }
}

initCookies();

// ─── Player client strategies (tried in order) ────────────────────────────────
// Each strategy targets a different YouTube internal player.
// tv_embedded + mweb don't require login and bypass bot checks on datacenter IPs.
// ios/android are authenticated clients that often work when web clients are blocked.
const STRATEGIES = [
    { client: 'tv_embedded',         skipDash: true  },
    { client: 'mweb',                skipDash: false },
    { client: 'android',             skipDash: false },
    { client: 'ios',                 skipDash: false },
    { client: 'web_creator',         skipDash: false },
];

function buildFlags(client, skipDash, useCookies = true) {
    const isWindows = process.platform === 'win32';
    const skipPart = skipDash ? ';skip=dash' : '';
    const extractorArgs = `youtube:player_client=${client}${skipPart}`;

    const flags = [
        '--no-check-certificates',
        '--no-warnings',
        isWindows
            ? `--extractor-args "${extractorArgs}"`
            : `--extractor-args '${extractorArgs}'`,
        // Spoof as Chrome — helps with some geo/bot checks
        '--add-header "User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"',
        '--add-header "Accept-Language:en-US,en;q=0.9"',
    ];

    // Only attach cookies if they exist AND useCookies is true
    if (useCookies && COOKIE_FILE) {
        if (isWindows) {
            flags.push(`--cookies "${COOKIE_FILE}"`);
        } else {
            const safe = COOKIE_FILE.replace(/'/g, "'\\''");
            flags.push(`--cookies '${safe}'`);
        }
    }

    return flags.join(' ');
}

// ─── Utility: run yt-dlp with automatic strategy fallback ────────────────────
// Tries each player client in order. If cookies cause an error (rotated/invalid),
// automatically retries without cookies before moving to the next client.
function runYtDlp(args, timeoutMs = 120000) {
    const bin = getYtDlpBinary();
    const isWindows = process.platform === 'win32';
    const shellOpts = isWindows
        ? { shell: true, maxBuffer: 20 * 1024 * 1024, timeout: timeoutMs }
        : { shell: '/bin/sh', maxBuffer: 20 * 1024 * 1024, timeout: timeoutMs };

    const isCookieError = (msg) =>
        msg.includes('no longer valid') ||
        msg.includes('cookies are no longer') ||
        msg.includes('Sign in to confirm') ||
        msg.includes('bot') ||
        msg.includes('This video is not available');

    // Build attempt list: [strategy+cookies, strategy-no-cookies] for each strategy
    const attempts = [];
    for (const s of STRATEGIES) {
        if (COOKIE_FILE) attempts.push({ ...s, useCookies: true });
        attempts.push({ ...s, useCookies: false });
    }

    function tryNext(index) {
        if (index >= attempts.length) {
            return Promise.reject(new Error(
                'All player clients failed. YouTube is blocking this server\'s IP. ' +
                'Try refreshing cookies or use a different video source.'
            ));
        }
        const { client, skipDash, useCookies } = attempts[index];
        const flags = buildFlags(client, skipDash, useCookies);
        const cmd = `${bin} ${flags} ${args}`;

        console.log(`[yt-dlp] Trying client=${client} cookies=${useCookies}`);

        return new Promise((resolve, reject) => {
            exec(cmd, shellOpts, (err, stdout, stderr) => {
                if (!err) return resolve(stdout.trim());
                const msg = stderr || err.message || '';
                // If it's a bot/cookie error, try next strategy
                if (isCookieError(msg)) {
                    console.warn(`[yt-dlp] client=${client} blocked — trying next strategy`);
                    return tryNext(index + 1).then(resolve).catch(reject);
                }
                // Non-bot error (bad URL, private video, etc.) — fail immediately
                reject(new Error(msg));
            });
        });
    }

    return tryNext(0);
}

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'MediaDL Server is running' });
});

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

    try {
        const raw = await runYtDlp(`--dump-json --no-playlist "${url}"`);
        const info = JSON.parse(raw);

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
            thumbnail: info.thumbnail || (info.thumbnails && info.thumbnails[0]?.url) || null,
            duration: info.duration,
            duration_string: info.duration_string || formatDuration(info.duration),
            uploader: info.uploader || info.channel || 'Unknown',
            view_count: info.view_count,
            like_count: info.like_count,
            description: info.description ? info.description.slice(0, 300) : '',
            webpage_url: info.webpage_url || url,
            extractor: info.extractor_key || info.extractor || 'Unknown',
            ffmpeg,
            formats: presets,
        });
    } catch (err) {
        console.error('Info error:', err.message);
        res.status(500).json({ error: err.message || 'Failed to fetch video info' });
    }
});

// ─── GET /api/download ────────────────────────────────────────────────────────
app.get('/api/download', async (req, res) => {
    const { url, format, title } = req.query;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    const formatId = format || 'bestvideo+bestaudio/best';
    const safeTitle = (title || 'video').replace(/[^a-zA-Z0-9 _\-]/g, '_').slice(0, 80);
    const tmpDir = os.tmpdir();
    const ffmpeg = isFfmpegAvailable();

    const uniquePrefix = `mediadl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const outputTemplate = path.join(tmpDir, `${uniquePrefix}.%(ext)s`);

    const mergeFlag = ffmpeg ? '--merge-output-format mp4' : '';
    const audioFlags = ffmpeg ? '--audio-multistreams' : '';

    // For audio-only formats, post-process to mp3
    const isAudioOnly = formatId === 'bestaudio/best' || formatId.startsWith('bestaudio');
    const postProcess = isAudioOnly && ffmpeg
        ? '-x --audio-format mp3 --audio-quality 0'
        : mergeFlag;

    const ytdlpArgs = [
        `-o "${outputTemplate}"`,
        `-f "${formatId}"`,
        '--no-playlist',
        '--no-warnings',
        postProcess,
        `"${url}"`,
    ].filter(Boolean).join(' ');

    try {
        console.log(`[download] Starting: format=${formatId}, ffmpeg=${ffmpeg}`);
        await runYtDlp(ytdlpArgs, 300000); // 5 min timeout for large files

        // Find the output file by our unique prefix
        const allFiles = fs.readdirSync(tmpDir);
        const match = allFiles.find(f => f.startsWith(uniquePrefix));

        if (!match) {
            return res.status(500).json({ error: 'Downloaded file not found. The format may not be available for this video.' });
        }

        const actualFile = path.join(tmpDir, match);
        const ext = path.extname(actualFile).slice(1) || 'mp4';
        const downloadName = `${safeTitle}.${ext}`;

        console.log(`[download] Serving: ${match} (${formatBytes(fs.statSync(actualFile).size)})`);

        res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
        res.setHeader('Content-Type', getMimeType(ext));

        const fileSize = fs.statSync(actualFile).size;
        if (fileSize) res.setHeader('Content-Length', fileSize);

        const stream = fs.createReadStream(actualFile);
        stream.pipe(res);
        stream.on('end', () => { try { fs.unlinkSync(actualFile); } catch { } });
        stream.on('error', () => { try { fs.unlinkSync(actualFile); } catch { } });

    } catch (err) {
        console.error('[download] Error:', err.message);
        // Clean up partial files
        try {
            fs.readdirSync(tmpDir)
                .filter(f => f.startsWith(uniquePrefix))
                .forEach(f => { try { fs.unlinkSync(path.join(tmpDir, f)); } catch { } });
        } catch { }
        res.status(500).json({ error: err.message || 'Download failed' });
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
    console.log(`\nEndpoints:`);
    console.log(`  GET /api/health`);
    console.log(`  GET /api/info?url=<video_url>`);
    console.log(`  GET /api/download?url=<video_url>&format=<format_id>`);
    console.log(`  GET /api/check-ytdlp\n`);
});
