"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/context/ThemeContext";
import api from "@/lib/api";
import { useReCaptcha } from "@/components/ReCaptcha";

export default function ToolSection({ toolRef }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [videoInfo, setVideoInfo] = useState(null);
  const [selectedFormat, setSelectedFormat] = useState("");
  const [errorMsg, setErrorMsg] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState("");
  const [activeJobId, setActiveJobId] = useState(null);
  const [downloadHistory, setDownloadHistory] = useState([]);
  const [captchaToken, setCaptchaToken] = useState(null);
  const [captchaSatisfied, setCaptchaSatisfied] = useState(false);
  const [pendingDownloadAfterCaptcha, setPendingDownloadAfterCaptcha] = useState(false);
  const eventSourceRef = useRef(null);
  const turnstileContainerId = "turnstile-captcha-container";
  const {
    executeRecaptcha,
    isEnabled: isCaptchaEnabled,
    isReady: isCaptchaReady,
    provider: captchaProvider,
    lastErrorCode: captchaErrorCode,
    mountTurnstile,
    resetTurnstile,
  } = useReCaptcha();

  const HISTORY_KEY = "mediadl_download_history_v1";
  const CAPTCHA_SESSION_KEY = "mediadl_captcha_verified_v1";

  const loadHistory = () => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const saveHistory = (entries) => {
    setDownloadHistory(entries);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, 20)));
    } catch {
    }
  };

  const upsertHistory = (patch) => {
    setDownloadHistory((prev) => {
      const idx = prev.findIndex((item) => item.jobId === patch.jobId);
      const next = [...prev];
      if (idx >= 0) {
        next[idx] = { ...next[idx], ...patch, updatedAt: Date.now() };
      } else {
        next.unshift({ ...patch, updatedAt: Date.now() });
      }
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next.slice(0, 20)));
      } catch {
      }
      return next.slice(0, 20);
    });
  };

  useEffect(() => {
    setDownloadHistory(loadHistory());
    try {
      setCaptchaSatisfied(sessionStorage.getItem(CAPTCHA_SESSION_KEY) === "true");
    } catch {
      setCaptchaSatisfied(false);
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(CAPTCHA_SESSION_KEY, captchaSatisfied ? "true" : "false");
    } catch {
    }
  }, [captchaSatisfied]);

  useEffect(() => {
    if (captchaProvider !== "turnstile") return;
    if (captchaSatisfied) return;
    if (!videoInfo || !selectedFormat || downloading || captchaToken) return;
    mountTurnstile(turnstileContainerId, (token) => setCaptchaToken(token));
  }, [captchaProvider, captchaSatisfied, videoInfo, selectedFormat, downloading, captchaToken, mountTurnstile]);

  useEffect(() => {
    if (!pendingDownloadAfterCaptcha) return;
    if (!captchaToken || downloading) return;
    setPendingDownloadAfterCaptcha(false);
    proceedWithDownload(captchaToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingDownloadAfterCaptcha, captchaToken, downloading]);

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
    setCaptchaToken(null);
    resetTurnstile();

    try {
      const data = await api.getInfo(url, captchaToken);
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

  const proceedWithDownload = async (token) => {
    if (!videoInfo || !selectedFormat || downloading) return;
    setErrorMsg(null);

    setDownloading(true);
    setDownloadProgress(0);
    setDownloadStatus("Starting...");

    try {
      const job = await api.createDownloadJob(url, selectedFormat, videoInfo.title, token || captchaToken);
      const jobId = job.job_id;
      setCaptchaSatisfied(true);
      setActiveJobId(jobId);
      setDownloadStatus(job.message || "Queued...");

      upsertHistory({
        jobId,
        title: videoInfo.title || "Video",
        url,
        formatId: selectedFormat,
        status: "queued",
        progress: 0,
        error: null,
        createdAt: Date.now(),
      });

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const streamUrl = api.getProgressStreamUrl(jobId);
      const eventSource = new EventSource(streamUrl);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const status = payload.status || "processing";
          const progress = Number(payload.progress || 0);

          setDownloadStatus(payload.message || status);
          setDownloadProgress(progress);
          upsertHistory({
            jobId,
            status,
            progress,
            error: payload.error || null,
          });

          if (status === "completed") {
            eventSource.close();
            eventSourceRef.current = null;

            const primaryUrl = api.getJobFileUrl(jobId);
            const fallbackUrl = api.toAbsoluteUrl(payload.fallbackUrl || "");
            setDownloadStatus("Finalizing file...");
            setDownloadProgress(100);

            (async () => {
              try {
                await api.downloadWithFallback([primaryUrl, fallbackUrl], payload.fileName || videoInfo.title || "download");
                setDownloadStatus("Download Started!");
              } catch (downloadError) {
                setErrorMsg(downloadError.message || "Download file is unavailable.");
              } finally {
                setDownloading(false);
              }
            })();
          }

          if (status === "failed") {
            eventSource.close();
            eventSourceRef.current = null;
            setDownloading(false);
            setErrorMsg(payload.error || payload.message || "Download failed. Please try again.");
            setCaptchaToken(null);
            resetTurnstile();
          }
        } catch {
          setDownloading(false);
          setErrorMsg("Failed to read download progress update.");
        }
      };

      eventSource.onerror = async () => {
        try {
          const latest = await api.getJobStatus(jobId);
          if (latest.status === "completed") {
            const primaryUrl = api.getJobFileUrl(jobId);
            const fallbackUrl = api.toAbsoluteUrl(latest.fallbackUrl || "");
            setDownloadStatus("Finalizing file...");
            setDownloadProgress(100);
            await api.downloadWithFallback([primaryUrl, fallbackUrl], latest.fileName || videoInfo.title || "download");

            setDownloading(false);
            setDownloadStatus("Download Started!");
          } else if (latest.status === "failed") {
            setDownloading(false);
            setErrorMsg(latest.error || latest.message || "Download failed. Please try again.");
          }
        } catch {
          setDownloading(false);
          setErrorMsg("Progress connection lost. Please check job status and retry.");
        } finally {
          eventSource.close();
          eventSourceRef.current = null;
        }
      };
    } catch (err) {
      const errMessage = err.message || "Failed to start download job.";
      setDownloading(false);
      setErrorMsg(errMessage);
      setDownloadStatus("");
      if (/captcha|turnstile|recaptcha/i.test(errMessage)) {
        setCaptchaSatisfied(false);
        setCaptchaToken(null);
        setPendingDownloadAfterCaptcha(false);
        resetTurnstile();
      }
    }
  };

  const startDownload = async () => {
    if (!videoInfo || !selectedFormat || downloading) return;

    let token = captchaToken;

    if (isCaptchaEnabled && !captchaSatisfied) {
      if (captchaProvider === "turnstile" && !token) {
        if (captchaErrorCode) {
          setErrorMsg(`Captcha failed to initialize (Turnstile ${captchaErrorCode}). Check NEXT_PUBLIC_TURNSTILE_SITE_KEY domain config, or set NEXT_PUBLIC_RECAPTCHA_SITE_KEY as fallback.`);
          return;
        }
        setErrorMsg("Complete captcha and the download will start automatically.");
        setPendingDownloadAfterCaptcha(true);
        return;
      }

      if (captchaProvider === "recaptcha") {
        if (!isCaptchaReady) {
          setErrorMsg("Captcha is still loading. Please wait a few seconds.");
          return;
        }
        token = await executeRecaptcha("start_download");
        if (!token) {
          setErrorMsg("Captcha verification failed. Please try again.");
          return;
        }
        setCaptchaToken(token);
      }
    }

    await proceedWithDownload(token);
  };

  // ─── Reset ────────────────────────────────────────────────────────
  const resetAll = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setUrl("");
    setVideoInfo(null);
    setSelectedFormat("");
    setErrorMsg(null);
    setLoading(false);
    setDownloading(false);
    setDownloadProgress(0);
    setDownloadStatus("");
    setActiveJobId(null);
    if (!captchaSatisfied) {
      setCaptchaToken(null);
      resetTurnstile();
    }
    setPendingDownloadAfterCaptcha(false);
  };

  // ─── Format helpers ───────────────────────────────────────────────
  const fmtNum = (n) => {
    if (!n) return "";
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    return String(n);
  };

  const currentDownloadEntry = activeJobId
    ? downloadHistory.find((entry) => (
      entry.jobId === activeJobId
      && ["queued", "processing"].includes(String(entry.status || "").toLowerCase())
    ))
    : null;

  return (
    <section
      id="tool-section"
      ref={toolRef}
      className={`py-12 xs:py-16 sm:py-20 md:py-32 px-3 xs:px-4 sm:px-6 transition-colors duration-300 ${isDark
          ? "bg-gradient-to-b from-slate-950 to-slate-900"
          : "bg-gradient-to-b from-slate-50 to-white"
        }`}
    >
      <div className="max-w-3xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-8 xs:mb-12">
          {/* Badge */}
          <div className="flex justify-center mb-4">
            <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest border ${
              isDark
                ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                : "bg-blue-50 border-blue-300/60 text-blue-700"
            }`}>
              <i className="fas fa-download"></i> Get Started
            </span>
          </div>
          <h2
            className={`text-2xl xs:text-3xl sm:text-4xl md:text-5xl font-black mb-3 xs:mb-4 px-2 ${isDark
                ? "bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent"
                : "bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent"
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
              ? "bg-gradient-to-br from-slate-900/80 via-slate-800/40 to-slate-900/80 text-white border-slate-700/50 backdrop-blur-sm"
              : "bg-white/70 text-slate-900 border-slate-200 shadow-xl backdrop-blur-sm"
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
            {/* Label + Platform Badge */}
            <div className="flex justify-between items-center gap-2">
              <label
                htmlFor="video-url-input"
                className={`text-[10px] xs:text-xs font-semibold uppercase tracking-wider ${isDark ? "text-slate-300" : "text-slate-700"
                  }`}
              >
                Paste Video URL
              </label>
              {detectedPlatform && (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] xs:text-xs font-semibold whitespace-nowrap ${isDark
                    ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/40 text-blue-300"
                    : "bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-300/60 text-blue-700"
                  }`}
                >
                  {detectedPlatform.emoji} {detectedPlatform.name}
                </span>
              )}
            </div>
            <div className="space-y-2">
              {/* Input Row */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    id="video-url-input"
                    name="videoUrl"
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
                    autoComplete="url"
                  />
                </div>
                <button
                disabled={loading || !isUrlValid}
                onClick={fetchInfo}
                className={`px-4 xs:px-5 rounded-lg font-bold transition-all text-xs xs:text-sm flex items-center gap-1.5 shrink-0 ${loading || !isUrlValid
                    ? isDark
                      ? "bg-slate-700/30 cursor-not-allowed text-slate-500"
                      : "bg-slate-200/50 cursor-not-allowed text-slate-400"
                    : "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90 active:scale-95"
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
                  <i className="fas fa-search"></i>
                )}
                <span>{loading ? "Fetching…" : "Fetch"}</span>
              </button>
              </div>
            </div>
          </div>

          {/* ─── Video Info Result Card ─── */}
          {videoInfo && (
            <div className="animate-fadeIn">
              {/* Thumbnail + Info Card */}
              <div
                className={`rounded-xl overflow-hidden border-2 mb-6 backdrop-blur-sm transition-all hover:shadow-lg ${
                  isDark
                    ? "bg-gradient-to-br from-slate-800/60 to-slate-900/60 border-slate-700/40 hover:border-purple-500/40"
                    : "bg-gradient-to-br from-slate-50/80 to-white/80 border-slate-200 hover:border-slate-300"
                  }`}
              >
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-0">
                  {/* Thumbnail Container */}
                  <div className="relative sm:w-64 sm:shrink-0 flex-shrink-0 h-44 sm:h-auto">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={videoInfo.thumbnail}
                      alt={videoInfo.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.src =
                          "data:image/svg+xml;base64," +
                          btoa(
                            '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="225" viewBox="0 0 400 225"><rect width="400" height="225" fill="#0d1020"/><circle cx="200" cy="112" r="32" fill="rgba(124,92,252,0.18)" stroke="rgba(124,92,252,0.45)" stroke-width="1.5"/><polygon points="192,97 192,127 220,112" fill="rgba(124,92,252,0.65)"/></svg>'
                          );
                      }}
                    />
                    {/* Duration Badge */}
                    {videoInfo.duration_string && (
                      <span
                        className={`absolute bottom-3 right-3 text-xs font-bold px-2.5 py-1 rounded-md backdrop-blur-sm ${
                          isDark
                            ? "bg-black/70 text-white"
                            : "bg-black/60 text-white"
                          }`}
                      >
                        {videoInfo.duration_string}
                      </span>
                    )}
                  </div>

                  {/* Info Section */}
                  <div className="flex-1 p-5 xs:p-6 flex flex-col justify-between">
                    {/* Platform + Uploader */}
                    <div>
                      <div className="flex items-center gap-2.5 mb-3">
                        {detectedPlatform && (
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold ${
                              isDark
                                ? "bg-blue-500/20 border border-blue-500/40 text-blue-300"
                                : "bg-blue-50 border border-blue-300/60 text-blue-700"
                              }`}
                          >
                            {detectedPlatform.emoji} {detectedPlatform.name}
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h3
                        className={`text-base xs:text-lg sm:text-xl font-bold leading-snug mb-3 line-clamp-3 ${
                          isDark ? "text-white" : "text-slate-900"
                          }`}
                      >
                        {videoInfo.title || "Untitled Video"}
                      </h3>

                      {/* Uploader */}
                      {videoInfo.uploader && (
                        <p
                          className={`text-sm mb-3 ${
                            isDark ? "text-slate-400" : "text-slate-600"
                            }`}
                        >
                          By <span className="font-semibold">{videoInfo.uploader}</span>
                        </p>
                      )}
                    </div>

                    {/* Stats */}
                    <div
                      className={`grid grid-cols-2 xs:grid-cols-3 gap-3 pt-3 border-t ${
                        isDark ? "border-slate-700/50 text-slate-300" : "border-slate-200 text-slate-600"
                        }`}
                    >
                      {videoInfo.view_count > 0 && (
                        <div className="flex items-center gap-2 text-xs xs:text-sm">
                          <i className="fas fa-eye text-blue-400"></i>
                          <span>{fmtNum(videoInfo.view_count)}</span>
                        </div>
                      )}
                      {videoInfo.like_count > 0 && (
                        <div className="flex items-center gap-2 text-xs xs:text-sm">
                          <i className="fas fa-heart text-pink-400"></i>
                          <span>{fmtNum(videoInfo.like_count)}</span>
                        </div>
                      )}
                      {videoInfo.duration_string && (
                        <div className="flex items-center gap-2 text-xs xs:text-sm">
                          <i className="fas fa-clock text-purple-400"></i>
                          <span>{videoInfo.duration_string}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quality & Format Selector */}
              <div className="space-y-2 mb-5">
                <label
                  htmlFor="format-select"
                  className={`text-xs font-semibold uppercase tracking-widest ${
                    isDark ? "text-slate-300" : "text-slate-700"
                    }`}
                >
                  <i className="fas fa-cog mr-1.5"></i>Quality & Format
                </label>
                <div className="relative group">
                  <select
                    id="format-select"
                    name="format"
                    value={selectedFormat}
                    onChange={(e) => setSelectedFormat(e.target.value)}
                    className={`w-full px-4 py-3.5 rounded-lg border-2 appearance-none cursor-pointer transition-all text-sm font-medium pr-10 focus:outline-none ${
                      isDark
                        ? "bg-slate-800/60 text-white border-slate-600/50 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 hover:border-slate-500"
                        : "bg-slate-100/60 text-slate-900 border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 hover:border-slate-400"
                      }`}
                  >
                    {(videoInfo.formats || []).map((f) => (
                      <option key={f.format_id} value={f.format_id}>
                        {f.label || f.format_id}
                      </option>
                    ))}
                  </select>
                  <div
                    className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-lg ${
                      isDark ? "text-slate-400" : "text-slate-600"
                      }`}
                  >
                    <i className="fas fa-chevron-down"></i>
                  </div>
                </div>
              </div>

              {/* Action Buttons Container */}
              <div className="space-y-3">
                {/* Download Button */}
                <button
                  disabled={downloading || !selectedFormat}
                  onClick={startDownload}
                  className={`w-full py-4 xs:py-5 rounded-xl font-bold transition-all flex items-center justify-center gap-2.5 text-base xs:text-lg uppercase tracking-wide ${
                    downloading
                      ? "bg-gradient-to-r from-green-600 to-emerald-600 text-white"
                      : !selectedFormat
                        ? isDark
                          ? "bg-slate-700/40 cursor-not-allowed text-slate-500"
                          : "bg-slate-200/60 cursor-not-allowed text-slate-400"
                        : "bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white hover:opacity-90 active:scale-95"
                    }`}
                >
                  {downloading ? (
                    <>
                      <i className="fas fa-spinner fa-spin text-xl"></i>
                      <span>
                        {downloadProgress > 0
                          ? `${downloadStatus || "Downloading"} (${downloadProgress}%)`
                          : downloadStatus || "Preparing Download..."}
                      </span>
                    </>
                  ) : (
                    <>
                      <i className="fas fa-download text-xl"></i>
                      <span>Download Now</span>
                    </>
                  )}
                </button>

                {downloading && activeJobId && (
                  <p className={`text-[11px] text-center ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                    Job ID: {activeJobId}
                  </p>
                )}

                  {isCaptchaEnabled && !captchaSatisfied && captchaProvider === "turnstile" && videoInfo && !downloading && (
                  <div className="mt-3 w-full flex flex-col items-center px-2">
                    <div className="origin-center scale-75 min-[220px]:scale-90 xs:scale-100">
                      <div id={turnstileContainerId}></div>
                    </div>
                    {!captchaToken ? (
                      <p className={`mt-2 text-[11px] text-center ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                        Click Download Now once, then complete captcha to auto-start.
                      </p>
                    ) : (
                      <p className={`mt-2 text-[11px] text-center font-semibold flex items-center gap-1 ${isDark ? "text-green-300" : "text-green-600"}`}>
                        <i className="fas fa-check-circle"></i> Captcha Verified
                      </p>
                    )}
                  </div>
                )}

                {currentDownloadEntry && (
                  <div className={`rounded-lg border p-3 ${isDark ? "border-slate-700 bg-slate-900/40" : "border-slate-200 bg-slate-50"}`}>
                    <p className={`text-xs font-semibold mb-2 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                      Current Download
                    </p>
                    <div className={`rounded-md px-2 py-2 text-[11px] ${isDark ? "bg-slate-800/60" : "bg-white"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`font-medium truncate ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                          {currentDownloadEntry.title || "Untitled"}
                        </span>
                        <span className="text-blue-500">
                          {currentDownloadEntry.status}
                        </span>
                      </div>
                      <div className={`mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                        {Math.max(0, Number(currentDownloadEntry.progress || 0))}%
                      </div>
                    </div>
                  </div>
                )}

                {/* Download Another Button */}
                <button
                  onClick={resetAll}
                  className={`w-full py-3 xs:py-4 rounded-xl font-semibold text-sm xs:text-base transition-all flex items-center justify-center gap-2 hover:opacity-80 active:scale-95 ${
                    isDark
                      ? "bg-slate-800/50 text-slate-200"
                      : "bg-slate-200/60 text-slate-700"
                    }`}
                >
                  <i className="fas fa-plus"></i>
                  <span>Download Another Video</span>
                </button>
              </div>
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
                  <i className="fas fa-bolt text-base xs:text-lg text-blue-400"></i>
                  <span
                    className={`font-semibold ${isDark ? "text-slate-300" : "text-slate-700"
                      }`}
                  >
                    Fast
                  </span>
                </div>
                <div className="flex flex-col items-center gap-0.5 xs:gap-1">
                  <i className="fas fa-lock text-base xs:text-lg text-purple-400"></i>
                  <span
                    className={`font-semibold ${isDark ? "text-slate-300" : "text-slate-700"
                      }`}
                  >
                    Secure
                  </span>
                </div>
                <div className="flex flex-col items-center gap-0.5 xs:gap-1">
                  <i className="fas fa-star text-base xs:text-lg text-pink-400"></i>
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
