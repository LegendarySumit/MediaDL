/**
 * Centralized API client
 * Handles all backend communication
 * 
 * Automatically uses the correct API base URL based on environment
 */

// Determine API base URL intelligently
function getApiBase() {
  // Check if NEXT_PUBLIC_API_URL is set (recommended for split deployment)
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
  }

  if (typeof window === 'undefined') {
    return 'http://localhost:8001';
  }
  
  const isDev = process.env.NODE_ENV === 'development';
  const hostname = window.location.hostname;
  
  // Development environment or local testing
  if (isDev || hostname === 'localhost' || hostname === '127.0.0.1') {
    return `http://${hostname}:8001`;
  }
  
  // Production fallback: If no env var, use current origin
  // In our new Vercel + Render setup, this shouldn't be reached if env var is set
  return '';
}

const API_BASE = getApiBase();

/**
 * Fetch with error handling
 */
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': options.headers?.['Content-Type'] || 'application/json',
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    throw new Error(error.message || 'API request failed');
  }
}

/**
 * API Methods
 */
const api = {
  getApiBase,
  
  // History endpoints
  getHistory: (limit = 50) => 
    apiFetch(`/api/history?limit=${limit}`),
  
  getJobDetails: (jobId) => 
    apiFetch(`/api/history/${jobId}`),
  
  getJobsByStatus: (status, limit = 50) => 
    apiFetch(`/api/history/status/${status}?limit=${limit}`),
  
  getJobsByPlatform: (platform, limit = 50) => 
    apiFetch(`/api/history/platform/${platform}?limit=${limit}`),
  
  getStats: () => 
    apiFetch('/api/history/stats/overview'),
  
  // Download management
  startVideo: (url, quality, cookies = "") =>
    apiFetch('/api/start/video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ url, quality, cookies })
    }),
  
  startAudio: (url, quality, cookies = "") =>
    apiFetch('/api/start/audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ url, quality, cookies })
    }),
  
  // Job control
  deleteJob: (jobId) => 
    apiFetch(`/api/job/${jobId}`, { method: 'DELETE' }),
  
  retryJob: (jobId) => 
    apiFetch(`/api/history/${jobId}/retry`, { method: 'POST' }),
  
  getRetryInfo: (jobId) => 
    apiFetch(`/api/history/${jobId}/retry-info`),
  
  // Download control
  downloadFile: (jobId) => 
    `${API_BASE}/api/download/${jobId}`,
  
  // Progress streaming
  getProgressStream: (jobId) => 
    `${API_BASE}/api/progress/${jobId}`,
  
  // Health
  getHealth: () => 
    apiFetch('/api/health').catch(() => ({ status: 'error' })),
  
  getHealthDetailed: () => 
    apiFetch('/api/health/detailed').catch(() => ({})),
};

export default api;
