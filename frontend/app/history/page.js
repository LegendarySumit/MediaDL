'use client';

import Link from 'next/link';
import { useTheme } from '@/context/ThemeContext';

export default function HistoryPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark
        ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white'
        : 'bg-gradient-to-br from-blue-50 via-white to-slate-50 text-slate-900'
      }`}>
      {/* Header */}
      <div className={`border-b backdrop-blur-sm transition-colors duration-300 ${isDark
          ? 'bg-gradient-to-r from-slate-900/80 to-slate-800/80 border-slate-700/50'
          : 'bg-gradient-to-r from-white/80 to-slate-50/80 border-slate-200'
        }`}>
        <div className="max-w-6xl mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 py-4 xs:py-5 sm:py-6">
          <div className="flex items-center justify-between flex-wrap gap-3 xs:gap-4">
            <div>
              <h1 className="text-xl xs:text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">📋 Downloads</h1>
            </div>
            <Link
              href="/"
              className={`px-3 xs:px-4 py-1.5 xs:py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg transition font-semibold flex items-center gap-1.5 xs:gap-2 text-xs xs:text-sm !text-white ${isDark
                  ? 'border border-blue-500/30 shadow-lg shadow-blue-500/20'
                  : 'border border-blue-400/40 shadow-lg shadow-blue-500/30'
                }`}
            >
              <span>←</span>
              <span>Back to Download</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 py-5 xs:py-6 sm:py-8">
        <div className={`rounded-lg backdrop-blur-sm p-6 xs:p-8 sm:p-12 text-center transition-colors duration-300 ${isDark
            ? 'bg-slate-800/50 border border-slate-700/50'
            : 'bg-white/60 border border-slate-200'
          }`}>
          <p className="text-4xl mb-4">📥</p>
          <p className={`text-base xs:text-lg sm:text-xl mb-3 font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'
            }`}>Your downloads go straight to your device</p>
          <p className={`text-xs xs:text-sm mb-6 max-w-md mx-auto ${isDark ? 'text-slate-500' : 'text-slate-500'
            }`}>
            Files are downloaded directly to your browser&apos;s download folder. Check your downloads folder for your files.
          </p>
          <Link
            href="/"
            className={`inline-block px-4 xs:px-5 sm:px-6 py-2 xs:py-2.5 sm:py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg font-semibold transition text-xs xs:text-sm sm:text-base !text-white ${isDark
                ? 'border border-blue-500/30 shadow-lg shadow-blue-500/20'
                : 'border border-blue-400/40 shadow-xl shadow-blue-500/40'
              }`}
          >
            🚀 Start Downloading
          </Link>
        </div>
      </div>
    </div>
  );
}
