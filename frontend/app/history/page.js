'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

export default function HistoryPage() {
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
    const colors = {
      'done': 'bg-green-500/20 text-green-300 border border-green-500/50',
      'running': 'bg-blue-500/20 text-blue-300 border border-blue-500/50',
      'queued': 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/50',
      'error': 'bg-red-500/20 text-red-300 border border-red-500/50',
      'cancelled': 'bg-gray-500/20 text-gray-300 border border-gray-500/50',
    };
    return colors[status] || 'bg-gray-500/20 text-gray-300 border border-gray-500/50';
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
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header */}
      <div className="bg-linear-to-r from-slate-900/80 to-slate-800/80 border-b border-slate-700/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-linear-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">📋 Download History</h1>
              <p className="text-slate-400 text-sm mt-2">{filteredJobs.length} {filteredJobs.length === 1 ? 'download' : 'downloads'}</p>
            </div>
            <Link 
              href="/" 
              className="px-4 py-2 bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition border border-blue-500/30 font-semibold flex items-center gap-2"
            >
              <span>←</span>
              <span>Back to Download</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Filters */}
        <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 backdrop-blur-sm p-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value})}
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder-slate-500"
              >
                <option value="all">All Status</option>
                <option value="done">✅ Done</option>
                <option value="running">⏳ Running</option>
                <option value="queued">📋 Queued</option>
                <option value="error">❌ Error</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Platform
              </label>
              <select
                value={filters.platform}
                onChange={(e) => setFilters({...filters, platform: e.target.value})}
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder-slate-500"
              >
                <option value="all">All Platforms</option>
                <option value="youtube">▶️ YouTube</option>
                <option value="instagram">📷 Instagram</option>
                <option value="tiktok">🎵 TikTok</option>
                <option value="twitter">𝕏 Twitter</option>
              </select>
            </div>

            <div className="sm:col-span-2 lg:col-span-2 flex items-end gap-2">
              <button
                onClick={fetchJobs}
                className="flex-1 px-4 py-2 bg-slate-700/50 hover:bg-slate-700/70 text-slate-200 rounded-lg transition text-sm font-medium border border-slate-600/50"
              >
                🔄 Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-950/50 border border-red-700/50 text-red-300 px-4 py-3 rounded-lg mb-6 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <span className="text-xl">⚠️</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-20">
            <div className="inline-block animate-spin text-4xl mb-4">⏳</div>
            <p className="text-slate-400 text-lg">Loading your downloads...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredJobs.length === 0 && (
          <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 backdrop-blur-sm p-12 text-center">
            <p className="text-slate-400 text-xl mb-4">📭 No downloads yet</p>
            <p className="text-slate-500 text-sm mb-6">Your download history will appear here</p>
            <Link 
              href="/" 
              className="inline-block px-6 py-3 bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-semibold transition border border-blue-500/30"
            >
              Start Downloading
            </Link>
          </div>
        )}

        {/* Jobs List */}
        {!loading && filteredJobs.length > 0 && (
          <div className="space-y-3">
            {filteredJobs.map((job) => (
              <div 
                key={job.job_id} 
                className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 hover:border-slate-600/50 transition backdrop-blur-sm"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Left: Platform & Type */}
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{getPlatformIcon(job.platform)}</span>
                    <div>
                      <p className="font-semibold text-slate-200 capitalize">{job.platform}</p>
                      <p className="text-xs text-slate-400 capitalize">{job.type}</p>
                      <p className="text-xs text-slate-500 mt-1">{formatDate(job.created_at)}</p>
                    </div>
                  </div>

                  {/* Center: Status & Progress */}
                  <div className="flex flex-col justify-between">
                    <div>
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                        {job.status === 'done' && '✅'}
                        {job.status === 'running' && '⏳'}
                        {job.status === 'queued' && '📋'}
                        {job.status === 'error' && '❌'}
                        {' ' + job.status.toUpperCase()}
                      </span>
                    </div>
                    {job.status !== 'done' && job.status !== 'error' && (
                      <div className="mt-2">
                        <div className="w-full h-2 bg-slate-700/50 rounded-full overflow-hidden border border-slate-600/30">
                          <div 
                            className="h-full bg-linear-to-r from-blue-400 to-purple-500 transition-all" 
                            style={{width: `${job.progress}%`}}
                          ></div>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{job.progress}%</p>
                      </div>
                    )}
                  </div>

                  {/* Right: File & Actions */}
                  <div>
                    {job.file_name && (
                      <p className="text-xs text-slate-400 mb-3 truncate" title={job.file_name}>
                        📄 {job.file_name}
                      </p>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      {job.file_name && job.status === 'done' && (
                        <button
                          onClick={() => handleDownload(job.job_id, job.file_name)}
                          className="px-3 py-1 text-xs bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 rounded border border-blue-500/50 transition font-medium"
                          title="Download file"
                        >
                          📥 Download
                        </button>
                      )}
                      {job.status === 'error' && (
                        <button
                          onClick={() => handleRetry(job.job_id)}
                          className="px-3 py-1 text-xs bg-yellow-600/30 hover:bg-yellow-600/50 text-yellow-300 rounded border border-yellow-500/50 transition font-medium"
                          title="Retry download"
                        >
                          🔄 Retry
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(job.job_id)}
                        className="px-3 py-1 text-xs bg-red-600/30 hover:bg-red-600/50 text-red-300 rounded border border-red-500/50 transition font-medium"
                        title="Delete job"
                      >
                        🗑️ Delete
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
