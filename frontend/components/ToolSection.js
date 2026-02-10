"use client";

import { useState } from "react";
import Link from "next/link";
import { useTheme } from "@/context/ThemeContext";
import api from "@/lib/api";

export default function ToolSection({ toolRef }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState("video");
  const [videoQuality, setVideoQuality] = useState("720");
  const [audioQuality, setAudioQuality] = useState("192");
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [eta, setEta] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [downloadReady, setDownloadReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const resetState = () => {
    setProgress(0);
    setEta(null);
    setJobId(null);
    setFileName(null);
    setDownloadReady(false);
    setLoading(false);
    setErrorMsg(null);
  };

  const startDownload = async () => {
    if (!url) return;
    
    resetState();
    setLoading(true);
    setStartTime(Date.now());

    const formData = new FormData();
    formData.append("url", url);
    formData.append("cookies", "");

    const quality = mode === "video" ? videoQuality : audioQuality;
    formData.append("quality", quality);

    const endpoint = mode === "video" 
      ? `${api.getApiBase()}/start/video`
      : `${api.getApiBase()}/start/audio`;

    try {
      const res = await fetch(endpoint, { method: "POST", body: formData });
      const data = await res.json();

      if (data.job_id) {
        setJobId(data.job_id);
        listenProgress(data.job_id);
      } else {
        setErrorMsg(data.error || "Failed to start download");
        setLoading(false);
      }
    } catch (error) {
      setErrorMsg("Cannot connect to server. Ensure backend is running.");
      setLoading(false);
    }
  };

  const listenProgress = (jobId) => {
    const eventSource = new EventSource(api.getProgressStream(jobId));

    eventSource.onmessage = (event) => {
      if (event.data.startsWith("ERROR:")) {
        setErrorMsg(event.data.substring(6));
        eventSource.close();
        setLoading(false);
        return;
      }

      const parts = event.data.split("|");
      const value = parseFloat(parts[0]);
      setProgress(value);

      if (parts[1]) {
        setFileName(parts[1]);
      }

      if (value > 0 && value < 100 && startTime) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = value / elapsed;
        const remaining = (100 - value) / rate;
        setEta(Math.round(remaining));
      }

      if (value >= 100) {
        eventSource.close();
        setLoading(false);
        setDownloadReady(true);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      setLoading(false);
    };
  };

  const downloadFile = async () => {
    if (!jobId) return;
    try {
      const link = document.createElement("a");
      link.href = api.downloadFile(jobId);
      link.download = fileName || "download";
      link.click();
    } catch (error) {
      setErrorMsg("Failed to download file");
    }
  };

  const isValidUrl = (urlStr) => {
    try {
      new URL(urlStr);
      return urlStr.includes("youtube") || urlStr.includes("youtu.be") || 
             urlStr.includes("instagram") || urlStr.includes("tiktok") || 
             urlStr.includes("twitter") || urlStr.includes("facebook") || 
             urlStr.includes("x.com");
    } catch {
      return false;
    }
  };

  const isUrlValid = url && isValidUrl(url);

  return (
    <section id="tool-section" ref={toolRef} className={`py-20 sm:py-32 px-4 transition-colors duration-300 ${
      isDark
        ? "bg-linear-to-b from-slate-950 to-slate-900"
        : "bg-linear-to-b from-slate-50 to-white"
    }`}>
      <div className="max-w-3xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className={`text-4xl sm:text-5xl font-black mb-4 ${
            isDark 
              ? "bg-linear-to-r from-blue-400 to-sky-400 bg-clip-text text-transparent" 
              : "bg-linear-to-r from-blue-600 to-sky-600 bg-clip-text text-transparent"
          }`}>Get Started in 3 Clicks</h2>
          <p className={`text-lg ${
            isDark ? "text-slate-400" : "text-slate-600"
          }`}>
            Paste your link below and choose your format. We&apos;ll handle the rest.
          </p>
          <Link 
            href="/history"
            className={`inline-flex items-center gap-2 mt-6 px-4 py-2 rounded-lg transition text-sm font-medium border ${
              isDark
                ? "bg-slate-800/50 hover:bg-slate-800 text-slate-300 border-slate-700/50 hover:border-slate-600"
                : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300 shadow-sm"
            }`}
          >
            <span>📋</span>
            <span>View Download History</span>
          </Link>
        </div>

        {/* Downloader Card */}
        <div className={`rounded-2xl p-8 shadow-2xl border transition-colors duration-300 ${
          isDark
            ? "bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 text-white border-slate-700/50"
            : "bg-white text-slate-900 border-slate-200 shadow-xl"
        }`}>
          {/* Error Message */}
          {errorMsg && (
            <div className={`mb-5 p-4 border rounded-lg backdrop-blur-sm animate-fadeIn ${
              isDark
                ? "bg-red-950/50 border-red-700/50"
                : "bg-red-50 border-red-300"
            }`}>
              <div className="flex gap-3">
                <span className="text-2xl">⚠️</span>
                <div className="flex-1">
                  <p className={`text-sm font-semibold mb-1 ${
                    isDark ? "text-red-300" : "text-red-700"
                  }`}>Download Failed</p>
                  <p className={`text-xs ${
                    isDark ? "text-red-200/80" : "text-red-600"
                  }`}>{errorMsg}</p>
                </div>
              </div>
            </div>
          )}

          {/* URL Input */}
          <div className="space-y-2 mb-5">
            <label className={`text-xs font-semibold uppercase tracking-wider ${
              isDark ? "text-slate-300" : "text-slate-700"
            }`}>URL to Download</label>
            <div className="relative">
              <input
                className={`w-full p-3 rounded-lg border transition-all focus:outline-none text-sm backdrop-blur-sm disabled:opacity-50 ${
                  isDark
                    ? "bg-slate-800/50 text-white placeholder-slate-500"
                    : "bg-slate-50 text-slate-900 placeholder-slate-400"
                } ${
                  isUrlValid 
                    ? "border-green-500/50 focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                    : url 
                    ? "border-red-500/50 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                    : isDark
                    ? "border-slate-600/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    : "border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                }`}
                placeholder="Paste your YouTube, Instagram, TikTok link..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading}
                type="url"
              />
              {isUrlValid && (
                <div className={`absolute right-3 top-1/2 -translate-y-1/2 text-lg ${
                  isDark ? "text-green-400" : "text-green-600"
                }`}>✓</div>
              )}
            </div>
            {url && !isUrlValid && (
              <p className={`text-xs mt-1 ${
                isDark ? "text-red-400" : "text-red-600"
              }`}>⚠️ Please enter a valid YouTube, Instagram, TikTok, or similar URL</p>
            )}
          </div>

          {/* Mode Selector */}
          <div className="space-y-3 mb-6">
            <label className={`text-xs font-semibold uppercase tracking-wider ${
              isDark ? "text-slate-300" : "text-slate-700"
            }`}>Select Mode</label>
            <div className="grid grid-cols-2 gap-3">
              {["video", "audio"].map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  disabled={loading}
                  className={`p-3 rounded-lg border-2 transition-all font-semibold text-sm flex flex-col items-center gap-2 disabled:opacity-50 ${
                    mode === m
                      ? m === "video"
                        ? isDark
                          ? "bg-blue-600/30 border-blue-500 text-blue-300"
                          : "bg-blue-100 border-blue-500 text-blue-700"
                        : isDark
                        ? "bg-purple-600/30 border-purple-500 text-purple-300"
                        : "bg-purple-100 border-purple-500 text-purple-700"
                      : isDark
                      ? "bg-slate-700/30 border-slate-600 text-slate-400 hover:border-slate-500"
                      : "bg-slate-100 border-slate-300 text-slate-600 hover:border-slate-400"
                  }`}
                >
                  <span className="text-2xl">{m === "video" ? "🎬" : "🎵"}</span>
                  <span className="capitalize">{m}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quality Selector */}
          <div className="space-y-3 mb-6">
            <label className={`text-xs font-semibold uppercase tracking-wider ${
              isDark ? "text-slate-300" : "text-slate-700"
            }`}>Quality</label>
            <div className="grid grid-cols-2 gap-2">
              {mode === "video" ? (
                <>
                  {[
                    { value: "144", label: "144p", desc: "Tiny" },
                    { value: "360", label: "360p", desc: "Small" },
                    { value: "720", label: "720p", desc: "Fast ⭐" },
                    { value: "1080", label: "1080p", desc: "HD" },
                  ].map((q) => (
                    <button
                      key={q.value}
                      onClick={() => setVideoQuality(q.value)}
                      disabled={loading}
                      className={`p-2 rounded-lg border-2 transition-all text-sm disabled:opacity-50 ${
                        videoQuality === q.value
                          ? isDark
                            ? "bg-blue-600/30 border-blue-500 text-blue-200 font-semibold"
                            : "bg-blue-100 border-blue-500 text-blue-700 font-semibold"
                          : isDark
                          ? "bg-slate-700/30 border-slate-600 text-slate-400 hover:border-slate-500"
                          : "bg-slate-100 border-slate-300 text-slate-600 hover:border-slate-400"
                      }`}
                    >
                      <div className="font-bold">{q.label}</div>
                      <div className="text-xs opacity-80">{q.desc}</div>
                    </button>
                  ))}
                </>
              ) : (
                <>
                  {[
                    { value: "192", label: "192 kbps", desc: "Fast" },
                    { value: "256", label: "256 kbps", desc: "Good" },
                    { value: "320", label: "320 kbps", desc: "Best ⭐" },
                  ].map((q) => (
                    <button
                      key={q.value}
                      onClick={() => setAudioQuality(q.value)}
                      disabled={loading}
                      className={`p-2 rounded-lg border-2 transition-all text-sm col-span-1 disabled:opacity-50 ${
                        audioQuality === q.value
                          ? isDark
                            ? "bg-purple-600/30 border-purple-500 text-purple-200 font-semibold"
                            : "bg-purple-100 border-purple-500 text-purple-700 font-semibold"
                          : isDark
                          ? "bg-slate-700/30 border-slate-600 text-slate-400 hover:border-slate-500"
                          : "bg-slate-100 border-slate-300 text-slate-600 hover:border-slate-400"
                      }`}
                    >
                      <div className="font-bold">{q.label}</div>
                      <div className="text-xs opacity-80">{q.desc}</div>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Download Button */}
          <button
            disabled={loading || !isUrlValid}
            onClick={startDownload}
            className={`w-full py-4 rounded-lg font-bold transition-all flex items-center justify-center gap-2 mb-5 text-base border-2 ${
              loading || !isUrlValid
                ? isDark
                  ? "bg-slate-700/20 border-slate-600/50 cursor-not-allowed text-slate-400"
                  : "bg-slate-200 border-slate-300 cursor-not-allowed text-slate-400"
                : "bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 border-transparent hover:shadow-lg hover:shadow-blue-600/50 active:scale-95 text-white"
            }`}
          >
            <span className="text-xl">⬇️</span>
            <span>Start Download</span>
          </button>

          {/* Loading & Progress Section */}
          {loading && (
            <div className={`space-y-4 mb-6 p-6 rounded-lg backdrop-blur-sm border ${
              isDark
                ? "bg-slate-700/20 border-slate-600/30"
                : "bg-slate-100 border-slate-300"
            }`}>
              {/* Spinner */}
              <div className="flex justify-center">
                <svg className="animate-spin h-12 w-12 text-blue-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>

              {/* Status Text */}
              <div className={`text-center font-semibold text-lg ${
                isDark ? "text-slate-300" : "text-slate-700"
              }`}>
                {progress > 0 ? "Downloading..." : "Starting download..."}
              </div>

              {/* Progress Bar */}
              {progress > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className={`w-full h-3 rounded-full overflow-hidden border ${
                        isDark
                          ? "bg-slate-700/50 border-slate-600/50"
                          : "bg-slate-200 border-slate-300"
                      }`}>
                        <div
                          className="h-full bg-linear-to-r from-blue-400 via-purple-500 to-pink-500 transition-all duration-300 shadow-lg shadow-blue-500/50"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                    <span className={`text-sm font-bold min-w-fit ${
                      isDark ? "text-blue-300" : "text-blue-600"
                    }`}>{progress.toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className={isDark ? "text-slate-400" : "text-slate-600"}>
                      {progress < 100 ? "Downloading..." : "Complete!"}
                    </span>
                    {eta && progress < 100 && (
                      <span className={`font-semibold ${
                        isDark ? "text-purple-300" : "text-purple-600"
                      }`}>⏱️ ~{eta}s remaining</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Done Message */}
          {downloadReady && progress >= 100 && fileName && (
            <div className={`space-y-3 mb-4 p-4 rounded-lg border backdrop-blur-sm animate-fadeIn ${
              isDark
                ? "bg-linear-to-br from-green-950/40 to-emerald-950/40 border-green-700/50"
                : "bg-linear-to-br from-green-50 to-emerald-50 border-green-300"
            }`}>
              <div className="text-center">
                <div className="text-5xl mb-2 animate-bounce">✅</div>
                <p className={`font-bold text-base ${
                  isDark ? "text-green-300" : "text-green-700"
                }`}>Success!</p>
                <p className={`text-xs mt-1 ${
                  isDark ? "text-green-200/60" : "text-green-600"
                }`}>Your download is ready</p>
              </div>
              
              <div className={`rounded-lg p-3 border ${
                isDark
                  ? "bg-slate-900/50 border-slate-700/50"
                  : "bg-white border-slate-200"
              }`}>
                <p className={`text-xs mb-1 ${
                  isDark ? "text-slate-400" : "text-slate-600"
                }`}>📄 File name:</p>
                <p className={`text-sm font-mono break-all font-semibold max-h-20 overflow-auto ${
                  isDark ? "text-green-300" : "text-green-700"
                }`}>{fileName}</p>
              </div>
              
              <button
                onClick={downloadFile}
                className="w-full py-3 rounded-lg bg-linear-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 font-bold text-white transition-all active:scale-95 border border-green-500/30 flex items-center justify-center gap-2 text-sm"
              >
                <span>📥</span>
                <span>Download File</span>
              </button>
              
              <button
                onClick={() => {
                  setUrl("");
                  resetState();
                }}
                className={`w-full py-2 rounded-lg font-semibold text-sm transition-all border ${
                  isDark
                    ? "bg-slate-700/50 hover:bg-slate-700/70 text-slate-200 border-slate-600/50"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
                }`}
              >
                ➕ Download Another
              </button>
            </div>
          )}

          {/* Footer */}
          <div className={`border-t pt-4 mt-6 ${
            isDark ? "border-slate-700/50" : "border-slate-200"
          }`}>
            <div className={`grid grid-cols-3 gap-3 text-center text-xs mb-3 ${
              isDark ? "text-slate-400" : "text-slate-600"
            }`}>
              <div className="flex flex-col items-center gap-1">
                <span className="text-lg">⚡</span>
                <span className={`font-semibold ${
                  isDark ? "text-slate-300" : "text-slate-700"
                }`}>Fast</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-lg">🔒</span>
                <span className={`font-semibold ${
                  isDark ? "text-slate-300" : "text-slate-700"
                }`}>Secure</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-lg">✨</span>
                <span className={`font-semibold ${
                  isDark ? "text-slate-300" : "text-slate-700"
                }`}>Free</span>
              </div>
            </div>
            <p className={`text-xs text-center ${
              isDark ? "text-slate-500" : "text-slate-500"
            }`}>No signups needed • Downloads processed locally</p>
          </div>
        </div>
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
    </section>
  );
}
