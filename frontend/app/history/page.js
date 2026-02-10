'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useTheme } from '@/context/ThemeContext';

export default function HistoryPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    status: 'all',
    platform: 'all',
  });

  // Fetch jobs from API
  const fetchJobs = async () => {
    try {
      setLoading(true);
      const data = await api.getHistory(100);
      setJobs(data.items || []);
      setError(null);
    } catch (err) {
      setError('Failed to load history: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    // Refresh every 5 seconds
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  // Delete job
  const handleDelete = async (jobId) => {
    if (!confirm('Are you sure you want to delete this job?')) return;
    
    try {
      const data = await api.deleteJob(jobId);
      if (data.status === 'deleted') {
        setJobs(jobs.filter(j => j.job_id !== jobId));
      } else {
        alert('Error: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  };

  // Retry job
  const handleRetry = async (jobId) => {
    try {
      const data = await api.retryJob(jobId);
      if (data.job_id) {
        alert('Retry job created: ' + data.job_id);
        fetchJobs(); // Refresh list
      } else {
        alert('Error: ' + (data.error || 'Cannot retry'));
      }
    } catch (err) {
      alert('Failed to retry: ' + err.message);
    }
  };

  // Download file
  const handleDownload = (jobId, fileName) => {
    if (!fileName) {
      alert('No file available');
      return;
    }
    
    window.location.href = api.downloadFile(jobId);
  };

  // Filter jobs
  const filteredJobs = jobs.filter(job => {
    if (filters.status !== 'all' && job.status !== filters.status) return false;
    if (filters.platform !== 'all' && job.platform !== filters.platform) return false;
    return true;
  });

  // Format date
  const formatDate = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  // Status badge color
  const getStatusColor = (status) => {
    if (isDark) {
      const colors = {
        'done': 'bg-green-500/20 text-green-300 border border-green-500/50',
        'running': 'bg-blue-500/20 text-blue-300 border border-blue-500/50',
        'queued': 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/50',
        'error': 'bg-red-500/20 text-red-300 border border-red-500/50',
        'cancelled': 'bg-gray-500/20 text-gray-300 border border-gray-500/50',
      };
      return colors[status] || 'bg-gray-500/20 text-gray-300 border border-gray-500/50';
    } else {
      const colors = {
        'done': 'bg-green-100 text-green-700 border border-green-300',
        'running': 'bg-blue-100 text-blue-700 border border-blue-300',
        'queued': 'bg-yellow-100 text-yellow-700 border border-yellow-300',
        'error': 'bg-red-100 text-red-700 border border-red-300',
        'cancelled': 'bg-gray-100 text-gray-700 border border-gray-300',
      };
      return colors[status] || 'bg-gray-100 text-gray-700 border border-gray-300';
    }
  };

  // Platform icon
  const getPlatformIcon = (platform) => {
    const icons = {
      'youtube': '▶️',
      'instagram': '📷',
      'tiktok': '🎵',
      'twitter': '𝕏',
      'facebook': '👍',
    };
    return icons[platform] || '🔗';
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      isDark
        ? 'bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 text-white'
        : 'bg-linear-to-br from-blue-50 via-white to-slate-50 text-slate-900'
    }`}>
      {/* Header */}
      <div className={`border-b backdrop-blur-sm transition-colors duration-300 ${
        isDark
          ? 'bg-linear-to-r from-slate-900/80 to-slate-800/80 border-slate-700/50'
          : 'bg-linear-to-r from-white/80 to-slate-50/80 border-slate-200'
      }`}>
        <div className="max-w-6xl mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 py-4 xs:py-5 sm:py-6">
          <div className="flex items-center justify-between flex-wrap gap-3 xs:gap-4">
            <div>
              <h1 className="text-xl xs:text-2xl sm:text-3xl font-bold bg-linear-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">📋 Download History</h1>
              <p className={`text-xs xs:text-sm mt-1 xs:mt-2 ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}>{filteredJobs.length} {filteredJobs.length === 1 ? 'download' : 'downloads'}</p>
            </div>
            <Link 
              href="/" 
              className={`px-3 xs:px-4 py-1.5 xs:py-2 bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg transition font-semibold flex items-center gap-1.5 xs:gap-2 text-xs xs:text-sm !text-white ${
                isDark
                  ? 'border border-blue-500/30 shadow-lg shadow-blue-500/20'
                  : 'border border-blue-400/40 shadow-lg shadow-blue-500/30'
              }`}
            >
              <span>←</span>
              <span className="hidden xs:inline">Back to Download</span>
              <span className="xs:hidden">Back</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 py-5 xs:py-6 sm:py-8">
        {/* Filters */}
        <div className={`rounded-lg backdrop-blur-sm p-3 xs:p-4 mb-4 xs:mb-6 transition-colors duration-300 ${
          isDark
            ? 'bg-slate-800/50 border border-slate-700/50'
            : 'bg-white/60 border border-slate-200'
        }`}>
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 xs:gap-4">
            <div>
              <label className={`block text-xs xs:text-sm font-semibold mb-1.5 xs:mb-2 ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}>
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value})}
                className={`w-full px-2.5 xs:px-3 py-1.5 xs:py-2 rounded-lg text-xs xs:text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${
                  isDark
                    ? 'bg-slate-700/50 border border-slate-600/50 text-white placeholder-slate-500'
                    : 'bg-white border border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
              >
                <option value="all">All Status</option>
                <option value="done">✅ Done</option>
                <option value="running">⏳ Running</option>
                <option value="queued">📋 Queued</option>
                <option value="error">❌ Error</option>
              </select>
            </div>

            <div>
              <label className={`block text-xs xs:text-sm font-semibold mb-1.5 xs:mb-2 ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}>
                Platform
              </label>
              <select
                value={filters.platform}
                onChange={(e) => setFilters({...filters, platform: e.target.value})}
                className={`w-full px-2.5 xs:px-3 py-1.5 xs:py-2 rounded-lg text-xs xs:text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${
                  isDark
                    ? 'bg-slate-700/50 border border-slate-600/50 text-white placeholder-slate-500'
                    : 'bg-white border border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
              >
                <option value="all">All Platforms</option>
                <option value="youtube">▶️ YouTube</option>
                <option value="instagram">📷 Instagram</option>
                <option value="tiktok">🎵 TikTok</option>
                <option value="twitter">𝕏 Twitter</option>
              </select>
            </div>

            <div className="xs:col-span-2 lg:col-span-2 flex items-end gap-2">
              <button
                onClick={fetchJobs}
                className={`flex-1 px-3 xs:px-4 py-1.5 xs:py-2 rounded-lg transition text-xs xs:text-sm font-medium ${
                  isDark
                    ? 'bg-slate-700/50 hover:bg-slate-700/70 text-slate-200 border border-slate-600/50'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                }`}
              >
                🔄 <span className="hidden xs:inline">Refresh</span>
              </button>
              <button
                onClick={() => setFilters({ status: 'all', platform: 'all' })}
                className={`flex-1 px-3 xs:px-4 py-1.5 xs:py-2 rounded-lg transition text-xs xs:text-sm font-medium ${
                  isDark
                    ? 'bg-slate-700/50 hover:bg-slate-700/70 text-slate-200 border border-slate-600/50'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                }`}
              >
                ✖️ <span className="hidden xs:inline">Clear</span>
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className={`backdrop-blur-sm px-3 xs:px-4 py-2.5 xs:py-3 rounded-lg mb-4 xs:mb-6 transition-colors duration-300 ${
            isDark
              ? 'bg-red-950/50 border border-red-700/50 text-red-300'
              : 'bg-red-50 border border-red-300 text-red-700'
          }`}>
            <div className="flex items-center gap-2 xs:gap-3">
              <span className="text-lg xs:text-xl">⚠️</span>
              <span className="text-xs xs:text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12 xs:py-16 sm:py-20">
            <div className="inline-block animate-spin text-3xl xs:text-4xl mb-3 xs:mb-4">⏳</div>
            <p className={`text-sm xs:text-base sm:text-lg ${
              isDark ? 'text-slate-400' : 'text-slate-600'
            }`}>Loading your downloads...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredJobs.length === 0 && (
          <div className={`rounded-lg backdrop-blur-sm p-6 xs:p-8 sm:p-12 text-center transition-colors duration-300 ${
            isDark
              ? 'bg-slate-800/50 border border-slate-700/50'
              : 'bg-white/60 border border-slate-200'
          }`}>
            <p className={`text-base xs:text-lg sm:text-xl mb-3 xs:mb-4 ${
              isDark ? 'text-slate-400' : 'text-slate-600'
            }`}>📭 No downloads yet</p>
            <p className={`text-xs xs:text-sm mb-4 xs:mb-6 ${
              isDark ? 'text-slate-500' : 'text-slate-500'
            }`}>Your download history will appear here</p>
            <Link 
              href="/" 
              className={`inline-block px-4 xs:px-5 sm:px-6 py-2 xs:py-2.5 sm:py-3 bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg font-semibold transition text-xs xs:text-sm sm:text-base !text-white ${
                isDark
                  ? 'border border-blue-500/30 shadow-lg shadow-blue-500/20'
                  : 'border border-blue-400/40 shadow-xl shadow-blue-500/40'
              }`}
            >
              Start Downloading
            </Link>
          </div>
        )}

        {/* Jobs List */}
        {!loading && filteredJobs.length > 0 && (
          <div className="space-y-2.5 xs:space-y-3">
            {filteredJobs.map((job) => (
              <div 
                key={job.job_id} 
                className={`rounded-lg p-3 xs:p-4 transition backdrop-blur-sm ${
                  isDark
                    ? 'bg-slate-800/50 border border-slate-700/50 hover:border-slate-600/50'
                    : 'bg-white/60 border border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 xs:gap-4">
                  {/* Left: Platform & Type */}
                  <div className="flex items-start gap-2 xs:gap-3">
                    <span className="text-xl xs:text-2xl">{getPlatformIcon(job.platform)}</span>
                    <div className="min-w-0 flex-1">
                      <p className={`font-semibold text-sm xs:text-base capitalize truncate ${
                        isDark ? 'text-slate-200' : 'text-slate-800'
                      }`}>{job.platform}</p>
                      <p className={`text-[10px] xs:text-xs capitalize ${
                        isDark ? 'text-slate-400' : 'text-slate-600'
                      }`}>{job.type}</p>
                      <p className={`text-[10px] xs:text-xs mt-0.5 xs:mt-1 ${
                        isDark ? 'text-slate-500' : 'text-slate-500'
                      }`}>{formatDate(job.created_at)}</p>
                    </div>
                  </div>

                  {/* Center: Status & Progress */}
                  <div className="flex flex-col justify-between">
                    <div>
                      <span className={`inline-block px-2 xs:px-3 py-0.5 xs:py-1 rounded-full text-[10px] xs:text-xs font-medium ${getStatusColor(job.status)}`}>
                        {job.status === 'done' && '✅'}
                        {job.status === 'running' && '⏳'}
                        {job.status === 'queued' && '📋'}
                        {job.status === 'error' && '❌'}
                        {' ' + job.status.toUpperCase()}
                      </span>
                    </div>
                    {job.status !== 'done' && job.status !== 'error' && (
                      <div className="mt-2">
                        <div className={`w-full h-1.5 xs:h-2 rounded-full overflow-hidden ${
                          isDark
                            ? 'bg-slate-700/50 border border-slate-600/30'
                            : 'bg-slate-200 border border-slate-300'
                        }`}>
                          <div 
                            className="h-full bg-linear-to-r from-blue-400 to-purple-500 transition-all" 
                            style={{width: `${job.progress}%`}}
                          ></div>
                        </div>
                        <p className={`text-[10px] xs:text-xs mt-1 ${
                          isDark ? 'text-slate-400' : 'text-slate-600'
                        }`}>{job.progress}%</p>
                      </div>
                    )}
                  </div>

                  {/* Right: File & Actions */}
                  <div className="sm:col-span-2 md:col-span-1">
                    {job.file_name && (
                      <p className={`text-[10px] xs:text-xs mb-2 xs:mb-3 truncate ${
                        isDark ? 'text-slate-400' : 'text-slate-600'
                      }`} title={job.file_name}>
                        📄 {job.file_name}
                      </p>
                    )}
                    <div className="flex gap-1.5 xs:gap-2 flex-wrap">
                      {job.file_name && job.status === 'done' && (
                        <button
                          onClick={() => handleDownload(job.job_id, job.file_name)}
                          className={`px-2 xs:px-3 py-0.5 xs:py-1 text-[10px] xs:text-xs rounded transition font-medium ${
                            isDark
                              ? 'bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/50'
                              : 'bg-blue-100 hover:bg-blue-200 text-blue-700 border border-blue-300'
                          }`}
                          title="Download file"
                        >
                          📥 <span className="hidden xs:inline">Download</span>
                        </button>
                      )}
                      {job.status === 'error' && (
                        <button
                          onClick={() => handleRetry(job.job_id)}
                          className={`px-2 xs:px-3 py-0.5 xs:py-1 text-[10px] xs:text-xs rounded transition font-medium ${
                            isDark
                              ? 'bg-yellow-600/30 hover:bg-yellow-600/50 text-yellow-300 border border-yellow-500/50'
                              : 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700 border border-yellow-300'
                          }`}
                          title="Retry download"
                        >
                          🔄 <span className="hidden xs:inline">Retry</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(job.job_id)}
                        className={`px-2 xs:px-3 py-0.5 xs:py-1 text-[10px] xs:text-xs rounded transition font-medium ${
                          isDark
                            ? 'bg-red-600/30 hover:bg-red-600/50 text-red-300 border border-red-500/50'
                            : 'bg-red-100 hover:bg-red-200 text-red-700 border border-red-300'
                        }`}
                        title="Delete job"
                      >
                        🗑️ <span className="hidden xs:inline">Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
