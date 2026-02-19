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

  // Check for explicit API URL override
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
  }

  // Development or local testing
  if (isDev || hostname === 'localhost' || hostname === '127.0.0.1') {
    return `http://${hostname}:3001`;
  }

  // Production: same origin
  return '';
}

const API_BASE = getApiBase();

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

  /** Check if yt-dlp is installed and get version info */
  checkYtDlp: () =>
    apiFetch('/api/check-ytdlp').catch(() => ({ available: false })),

  /** Health check */
  getHealth: () =>
    apiFetch('/api/health').catch(() => ({ status: 'error' })),

  /** Fetch video info (title, thumbnail, formats, etc.) */
  getInfo: (url) =>
    apiFetch(`/api/info?url=${encodeURIComponent(url)}`),

  /** Build the download URL (triggers file download via browser) */
  getDownloadUrl: (url, formatId, title) =>
    `${API_BASE}/api/download?url=${encodeURIComponent(url)}&format=${encodeURIComponent(formatId)}&title=${encodeURIComponent(title || 'video')}`,
};

export default api;
