/**
 * Centralized API client for MediaDL
 * Communicates with the Node.js backend powered by yt-dlp
 */

function getApiBase() {
  if (typeof window === 'undefined') {
    return 'http://localhost:3001';
  }

  const hostname = window.location.hostname;
  const isDev = process.env.NODE_ENV === 'development';

  // Check for explicit API URL override (prefer documented var)
  const explicitApiBase = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL;
  if (explicitApiBase) {
    return explicitApiBase.replace(/\/$/, '');
  }

  // Development or local testing
  if (isDev || hostname === 'localhost' || hostname === '127.0.0.1') {
    return `http://${hostname}:3001`;
  }

  // Production: same origin
  return '';
}

const API_BASE = getApiBase();

const RETRYABLE_DOWNLOAD_STATUS = new Set([404, 409, 425, 429, 500, 502, 503, 504]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    throw new Error(error.message || 'API request failed');
  }
}

const api = {
  getApiBase,

  withCaptchaHeaders: (captchaToken, extraHeaders = {}) => {
    if (!captchaToken) return extraHeaders;
    return {
      ...extraHeaders,
      'x-captcha-token': captchaToken,
    };
  },

  /** Check if yt-dlp is installed and get version info */
  checkYtDlp: () =>
    apiFetch('/api/check-ytdlp').catch(() => ({ available: false })),

  /** Health check */
  getHealth: () =>
    apiFetch('/api/health').catch(() => ({ status: 'error' })),

  /** Fetch video info (title, thumbnail, formats, etc.) */
  getInfo: (url, captchaToken) =>
    apiFetch(`/api/info?url=${encodeURIComponent(url)}`, {
      headers: api.withCaptchaHeaders(captchaToken),
    }),

  /** Create async download job */
  createDownloadJob: (url, formatId, title, captchaToken) =>
    apiFetch('/api/jobs', {
      method: 'POST',
      headers: api.withCaptchaHeaders(captchaToken, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ url, format: formatId, title }),
    }),

  /** Check current download job status */
  getJobStatus: (jobId) =>
    apiFetch(`/api/jobs/${encodeURIComponent(jobId)}`),

  /** Build SSE URL for job progress */
  getProgressStreamUrl: (jobId) =>
    `${API_BASE}/api/progress?id=${encodeURIComponent(jobId)}`,

  /** Build final file URL when job is complete */
  getJobFileUrl: (jobId) =>
    `${API_BASE}/api/jobs/${encodeURIComponent(jobId)}/file`,

  toAbsoluteUrl: (relativeOrAbsoluteUrl) => {
    if (!relativeOrAbsoluteUrl) return null;
    if (/^https?:\/\//i.test(relativeOrAbsoluteUrl)) return relativeOrAbsoluteUrl;
    return `${API_BASE}${relativeOrAbsoluteUrl}`;
  },

  downloadWithFallback: async (urls, fileName) => {
    const tried = [];
    for (const candidate of urls) {
      if (!candidate) continue;
      tried.push(candidate);
      for (let attempt = 1; attempt <= 6; attempt += 1) {
        try {
          const response = await fetch(candidate, { cache: 'no-store' });
          if (response.ok) {
            const blob = await response.blob();
            const objectUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = objectUrl;
            a.download = fileName || 'download';
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(objectUrl);
            return true;
          }

          if (!RETRYABLE_DOWNLOAD_STATUS.has(response.status) || attempt === 6) {
            break;
          }
        } catch {
          if (attempt === 6) break;
        }

        await sleep(350 * attempt);
      }
    }

    throw new Error(`Failed to download file from available URLs: ${tried.join(', ')}`);
  },

  /** Build the download URL (triggers file download via browser) */
  getDownloadUrl: (url, formatId, title) =>
    `${API_BASE}/api/download?url=${encodeURIComponent(url)}&format=${encodeURIComponent(formatId)}&title=${encodeURIComponent(title || 'video')}`,
};

export default api;
