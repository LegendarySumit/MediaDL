/**
 * Centralized API client
 * Handles all backend communication
 * 
 * Automatically uses the correct API base URL based on environment
 */

// Determine API base URL intelligently
function getApiBase() {
  // In development: backend is on localhost:8000
  // In production/Docker: use relative path (handled by nginx reverse proxy)
  
  if (typeof window === 'undefined') {
    // SSR: use relative path
    return '/api';
  }
  
  const isDev = process.env.NODE_ENV === 'development';
  const hostname = window.location.hostname;
  const port = window.location.port;
  
  // Development environment: connect directly to backend on port 8001
  if (isDev) {
    return `http://${hostname}:8001`;
  }
  
  // Production/Docker: use relative path (nginx reverse proxy handles /api -> backend)
  return '/api';
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
    apiFetch('/start/video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ url, quality, cookies })
    }),
  
  startAudio: (url, quality, cookies = "") =>
    apiFetch('/start/audio', {
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
    `${API_BASE}/download/${jobId}`,
  
  // Progress streaming
  getProgressStream: (jobId) => 
    `${API_BASE}/progress/${jobId}`,
  
  // Health
  getHealth: () => 
    apiFetch('/health').catch(() => ({ status: 'error' })),
  
  getHealthDetailed: () => 
    apiFetch('/health/detailed').catch(() => ({})),
};

export default api;
