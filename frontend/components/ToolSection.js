"use client";

import { useState } from "react";
import { useTheme } from "@/context/ThemeContext";
import api from "@/lib/api";

export default function ToolSection({ toolRef }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [videoInfo, setVideoInfo] = useState(null);
  const [selectedFormat, setSelectedFormat] = useState("");
  const [errorMsg, setErrorMsg] = useState(null);
  const [downloading, setDownloading] = useState(false);

  // ─── Platform detection ───────────────────────────────────────────
  const PLATFORMS = [
    { name: "YouTube", pattern: /youtube\.com|youtu\.be/i, color: "#FF0000", emoji: "🔴" },
    { name: "Instagram", pattern: /instagram\.com/i, color: "#E1306C", emoji: "📸" },
    { name: "Facebook", pattern: /facebook\.com|fb\.watch/i, color: "#1877F2", emoji: "🔵" },
    { name: "TikTok", pattern: /tiktok\.com/i, color: "#fff", emoji: "🎵" },
    { name: "Twitter/X", pattern: /twitter\.com|x\.com/i, color: "#fff", emoji: "🐦" },
    { name: "Vimeo", pattern: /vimeo\.com/i, color: "#1AB7EA", emoji: "🎬" },
    { name: "Reddit", pattern: /reddit\.com/i, color: "#FF4500", emoji: "🟠" },
    { name: "Twitch", pattern: /twitch\.tv/i, color: "#9146FF", emoji: "💜" },
    { name: "SoundCloud", pattern: /soundcloud\.com/i, color: "#FF5500", emoji: "🔶" },
  ];

  const detectPlatform = (urlStr) => {
    for (const p of PLATFORMS) {
      if (p.pattern.test(urlStr)) return p;
    }
    return null;
  };

  const isValidUrl = (urlStr) => {
    try {
      new URL(urlStr);
      return urlStr.startsWith("http");
    } catch {
      return false;
    }
  };

  const detectedPlatform = url ? detectPlatform(url) : null;
  const isUrlValid = url && isValidUrl(url);

  // ─── Fetch video info ─────────────────────────────────────────────
  const fetchInfo = async () => {
    if (!url || !isUrlValid) return;
    setLoading(true);
    setErrorMsg(null);
    setVideoInfo(null);
    setSelectedFormat("");
    setDownloading(false);

    try {
      const data = await api.getInfo(url);
      setVideoInfo(data);
      // Auto-select recommended format
      const recommended = data.formats?.find((f) => f.note === "Recommended");
      if (recommended) setSelectedFormat(recommended.format_id);
      else if (data.formats?.length) setSelectedFormat(data.formats[0].format_id);
    } catch (err) {
      setErrorMsg(err.message || "Failed to fetch video info. Check the URL and try again.");
    } finally {
      setLoading(false);
    }
  };

  // ─── Download ─────────────────────────────────────────────────────
  const startDownload = () => {
    if (!videoInfo || !selectedFormat) return;
    setDownloading(true);
    const dlUrl = api.getDownloadUrl(url, selectedFormat, videoInfo.title);
    const a = document.createElement("a");
    a.href = dlUrl;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Reset download state after a delay
    setTimeout(() => {
      setDownloading(false);
    }, 4000);
  };

  // ─── Reset ────────────────────────────────────────────────────────
  const resetAll = () => {
    setUrl("");
    setVideoInfo(null);
    setSelectedFormat("");
    setErrorMsg(null);
    setLoading(false);
    setDownloading(false);
  };

  // ─── Format helpers ───────────────────────────────────────────────
  const fmtNum = (n) => {
    if (!n) return "";
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    return String(n);
  };

  return (
    <section
      id="tool-section"
      ref={toolRef}
      className={`py-12 xs:py-16 sm:py-20 md:py-32 px-3 xs:px-4 sm:px-6 transition-colors duration-300 ${isDark
          ? "bg-linear-to-b from-slate-950 to-slate-900"
          : "bg-linear-to-b from-slate-50 to-white"
        }`}
    >
      <div className="max-w-3xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-8 xs:mb-12">
          <h2
            className={`text-2xl xs:text-3xl sm:text-4xl md:text-5xl font-black mb-3 xs:mb-4 px-2 ${isDark
                ? "bg-linear-to-r from-blue-400 to-sky-400 bg-clip-text text-transparent"
                : "bg-linear-to-r from-blue-600 to-sky-600 bg-clip-text text-transparent"
              }`}
          >
            Download Any Video
          </h2>
          <p
            className={`text-sm xs:text-base sm:text-lg px-2 ${isDark ? "text-slate-400" : "text-slate-600"
              }`}
          >
            Paste a link, fetch video info, pick your quality, and download.
          </p>
        </div>

        {/* Downloader Card */}
        <div
          className={`rounded-xl xs:rounded-2xl p-4 xs:p-6 sm:p-8 shadow-2xl border transition-colors duration-300 ${isDark
              ? "bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 text-white border-slate-700/50"
              : "bg-white text-slate-900 border-slate-200 shadow-xl"
            }`}
        >
          {/* Error Message */}
          {errorMsg && (
            <div
              className={`mb-4 xs:mb-5 p-3 xs:p-4 border rounded-lg backdrop-blur-sm animate-fadeIn ${isDark
                  ? "bg-red-950/50 border-red-700/50"
                  : "bg-red-50 border-red-300"
                }`}
            >
              <div className="flex gap-2 xs:gap-3">
                <span className="text-xl xs:text-2xl">⚠️</span>
                <div className="flex-1">
                  <p
                    className={`text-xs xs:text-sm font-semibold mb-1 ${isDark ? "text-red-300" : "text-red-700"
                      }`}
                  >
                    Something went wrong
                  </p>
                  <p
                    className={`text-[10px] xs:text-xs ${isDark ? "text-red-200/80" : "text-red-600"
                      }`}
                  >
                    {errorMsg}
                  </p>
                </div>
                <button
                  onClick={() => setErrorMsg(null)}
                  className={`text-xs self-start opacity-60 hover:opacity-100 transition ${isDark ? "text-red-300" : "text-red-500"
                    }`}
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* URL Input + Fetch */}
          <div className="space-y-1.5 xs:space-y-2 mb-4 xs:mb-5">
            <label
              className={`text-[10px] xs:text-xs font-semibold uppercase tracking-wider ${isDark ? "text-slate-300" : "text-slate-700"
                }`}
            >
              Paste Video URL
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  className={`w-full p-2.5 xs:p-3 rounded-lg border transition-all focus:outline-none text-xs xs:text-sm backdrop-blur-sm disabled:opacity-50 ${isDark
                      ? "bg-slate-800/50 text-white placeholder-slate-500"
                      : "bg-slate-50 text-slate-900 placeholder-slate-400"
                    } ${isUrlValid
                      ? "border-green-500/50 focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                      : url
                        ? "border-red-500/50 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                        : isDark
                          ? "border-slate-600/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                          : "border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    }`}
                  placeholder="https://youtube.com/watch?v=..."
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (videoInfo) {
                      setVideoInfo(null);
                      setSelectedFormat("");
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && isUrlValid) fetchInfo();
                  }}
                  disabled={loading}
                  type="url"
                />
                {detectedPlatform && (
                  <div
                    className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] xs:text-xs px-2 py-0.5 rounded-full font-medium ${isDark
                        ? "bg-slate-700/80 text-slate-300"
                        : "bg-slate-200 text-slate-600"
                      }`}
                  >
                    {detectedPlatform.emoji} {detectedPlatform.name}
                  </div>
                )}
              </div>
              <button
                disabled={loading || !isUrlValid}
                onClick={fetchInfo}
                className={`px-4 xs:px-5 rounded-lg font-bold transition-all text-xs xs:text-sm flex items-center gap-1.5 shrink-0 border-2 ${loading || !isUrlValid
                    ? isDark
                      ? "bg-slate-700/20 border-slate-600/50 cursor-not-allowed text-slate-500"
                      : "bg-slate-200 border-slate-300 cursor-not-allowed text-slate-400"
                    : "bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 border-transparent text-white hover:shadow-lg hover:shadow-blue-600/30 active:scale-95"
                  }`}
              >
                {loading ? (
                  <svg
                    className="animate-spin h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                ) : (
                  <span>🔍</span>
                )}
                <span>{loading ? "Fetching…" : "Fetch"}</span>
              </button>
            </div>
          </div>

          {/* ─── Video Info Result Card ─── */}
          {videoInfo && (
            <div className="animate-fadeIn">
              {/* Thumbnail + Info */}
              <div
                className={`rounded-lg overflow-hidden border mb-4 xs:mb-5 ${isDark ? "border-slate-700/50" : "border-slate-200"
                  }`}
              >
                <div className="flex flex-col sm:flex-row">
                  {/* Thumbnail */}
                  <div className="relative sm:w-52 sm:shrink-0">
                    <img
                      src={videoInfo.thumbnail}
                      alt={videoInfo.title}
                      className="w-full h-36 sm:h-full object-cover"
                      onError={(e) => {
                        e.target.src =
                          "data:image/svg+xml;base64," +
                          btoa(
                            '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="225" viewBox="0 0 400 225"><rect width="400" height="225" fill="#0d1020"/><circle cx="200" cy="112" r="32" fill="rgba(124,92,252,0.18)" stroke="rgba(124,92,252,0.45)" stroke-width="1.5"/><polygon points="192,97 192,127 220,112" fill="rgba(124,92,252,0.65)"/></svg>'
                          );
                      }}
                    />
                    {videoInfo.duration_string && (
                      <span
                        className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] xs:text-xs px-1.5 py-0.5 rounded font-mono"
                      >
                        {videoInfo.duration_string}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3 xs:p-4 flex-1 min-w-0">
                    {/* Platform Badge + Uploader */}
                    <div className="flex items-center gap-2 mb-1.5">
                      {detectedPlatform && (
                        <span
                          className={`text-[10px] xs:text-xs px-1.5 py-0.5 rounded font-medium ${isDark
                              ? "bg-slate-700/80 text-slate-300"
                              : "bg-slate-200 text-slate-600"
                            }`}
                        >
                          {detectedPlatform.emoji} {detectedPlatform.name}
                        </span>
                      )}
                      <span
                        className={`text-[10px] xs:text-xs truncate ${isDark ? "text-slate-400" : "text-slate-500"
                          }`}
                      >
                        {videoInfo.uploader}
                      </span>
                    </div>

                    {/* Title */}
                    <h3
                      className={`text-sm xs:text-base font-bold leading-snug mb-2 line-clamp-2 ${isDark ? "text-white" : "text-slate-900"
                        }`}
                    >
                      {videoInfo.title || "Untitled Video"}
                    </h3>

                    {/* Stats */}
                    <div
                      className={`flex flex-wrap gap-3 text-[10px] xs:text-xs ${isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                    >
                      {videoInfo.view_count > 0 && (
                        <span>👁 {fmtNum(videoInfo.view_count)} views</span>
                      )}
                      {videoInfo.like_count > 0 && (
                        <span>❤ {fmtNum(videoInfo.like_count)}</span>
                      )}
                      {videoInfo.duration_string && (
                        <span>⏱ {videoInfo.duration_string}</span>
                      )}
                      {videoInfo.ffmpeg !== undefined && (
                        <span>
                          {videoInfo.ffmpeg ? "🔧 ffmpeg ✓" : "⚠️ no ffmpeg"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Format Selector */}
              <div className="space-y-1.5 xs:space-y-2 mb-4 xs:mb-5">
                <label
                  className={`text-[10px] xs:text-xs font-semibold uppercase tracking-wider ${isDark ? "text-slate-300" : "text-slate-700"
                    }`}
                >
                  Quality & Format
                </label>
                <div className="relative">
                  <select
                    value={selectedFormat}
                    onChange={(e) => setSelectedFormat(e.target.value)}
                    className={`w-full p-2.5 xs:p-3 rounded-lg border appearance-none cursor-pointer transition-all text-xs xs:text-sm pr-10 focus:outline-none ${isDark
                        ? "bg-slate-800/50 text-white border-slate-600/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        : "bg-slate-50 text-slate-900 border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      }`}
                  >
                    {(videoInfo.formats || []).map((f) => (
                      <option key={f.format_id} value={f.format_id}>
                        {f.label || f.format_id}
                      </option>
                    ))}
                  </select>
                  <div
                    className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? "text-slate-400" : "text-slate-500"
                      }`}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Download Button */}
              <button
                disabled={downloading || !selectedFormat}
                onClick={startDownload}
                className={`w-full py-3 xs:py-3.5 sm:py-4 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 xs:gap-2 mb-3 text-sm xs:text-base border-2 ${downloading
                    ? "bg-linear-to-r from-green-600 to-emerald-600 border-green-500/30 text-white"
                    : !selectedFormat
                      ? isDark
                        ? "bg-slate-700/20 border-slate-600/50 cursor-not-allowed text-slate-400"
                        : "bg-slate-200 border-slate-300 cursor-not-allowed text-slate-400"
                      : "bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 border-transparent hover:shadow-lg hover:shadow-blue-600/50 active:scale-95 text-white"
                  }`}
              >
                {downloading ? (
                  <>
                    <span className="text-lg xs:text-xl">✅</span>
                    <span>Download Started!</span>
                  </>
                ) : (
                  <>
                    <span className="text-lg xs:text-xl">⬇️</span>
                    <span>Download</span>
                  </>
                )}
              </button>

              {/* New URL button */}
              <button
                onClick={resetAll}
                className={`w-full py-1.5 xs:py-2 rounded-lg font-semibold text-xs xs:text-sm transition-all border ${isDark
                    ? "bg-slate-700/50 hover:bg-slate-700/70 text-slate-200 border-slate-600/50"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
                  }`}
              >
                ➕ Download Another
              </button>
            </div>
          )}

          {/* Loading spinner when fetching */}
          {loading && (
            <div className="flex flex-col items-center gap-3 py-8">
              <svg
                className="animate-spin h-10 w-10 text-blue-500"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <p
                className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-600"
                  }`}
              >
                Fetching video info…
              </p>
              <p
                className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"
                  }`}
              >
                This may take a few seconds
              </p>
            </div>
          )}

          {/* Footer hints — show only when no video info */}
          {!videoInfo && !loading && (
            <div
              className={`border-t pt-3 xs:pt-4 mt-4 xs:mt-6 ${isDark ? "border-slate-700/50" : "border-slate-200"
                }`}
            >
              <div
                className={`grid grid-cols-3 gap-2 xs:gap-3 text-center text-[10px] xs:text-xs mb-2 xs:mb-3 ${isDark ? "text-slate-400" : "text-slate-600"
                  }`}
              >
                <div className="flex flex-col items-center gap-0.5 xs:gap-1">
                  <span className="text-base xs:text-lg">⚡</span>
                  <span
                    className={`font-semibold ${isDark ? "text-slate-300" : "text-slate-700"
                      }`}
                  >
                    Fast
                  </span>
                </div>
                <div className="flex flex-col items-center gap-0.5 xs:gap-1">
                  <span className="text-base xs:text-lg">🔒</span>
                  <span
                    className={`font-semibold ${isDark ? "text-slate-300" : "text-slate-700"
                      }`}
                  >
                    Secure
                  </span>
                </div>
                <div className="flex flex-col items-center gap-0.5 xs:gap-1">
                  <span className="text-base xs:text-lg">✨</span>
                  <span
                    className={`font-semibold ${isDark ? "text-slate-300" : "text-slate-700"
                      }`}
                  >
                    Free
                  </span>
                </div>
              </div>
              <p
                className={`text-[10px] xs:text-xs text-center ${isDark ? "text-slate-500" : "text-slate-500"
                  }`}
              >
                No signups needed • Supports 1000+ sites • Powered by yt-dlp
              </p>
            </div>
          )}
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
