"use client";

import { motion } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";
import AnimatedBackground from "./AnimatedBackground";

export default function Hero({ onStartClick }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <section className={`min-h-screen pt-17.5 flex items-center justify-center px-4 relative overflow-hidden transition-colors duration-300 ${
      isDark
        ? "bg-linear-to-br from-slate-950 via-slate-900 to-slate-950"
        : "bg-linear-to-br from-blue-50 via-white to-slate-50"
    }`}>
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <AnimatedBackground isDark={isDark} />
        <div className={`absolute top-20 right-1/4 w-96 h-96 rounded-full blur-3xl ${
          isDark
            ? "bg-blue-600/10"
            : "bg-blue-400/30"
        }`} />
        <div className={`absolute bottom-20 left-1/4 w-96 h-96 rounded-full blur-3xl ${
          isDark
            ? "bg-purple-600/10"
            : "bg-purple-400/30"
        }`} />
      </div>

      <div className="max-w-4xl mx-auto text-center relative z-10">
        {/* Main Headline */}
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`text-5xl sm:text-6xl lg:text-7xl font-black mb-6 font-sans leading-tight ${
            isDark ? "text-white" : "text-slate-900"
          }`}
        >
          <span>Download Your </span>
          <span className="bg-linear-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            Favorite Media
          </span>
          <span> in Seconds</span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          className={`text-lg sm:text-xl mb-8 max-w-2xl mx-auto leading-relaxed ${
            isDark
              ? "text-slate-300"
              : "text-slate-600"
          }`}
        >
          Instantly download & convert videos from YouTube, Instagram, TikTok, and 100+ more. No login. No limits.
        </motion.p>

        {/* Feature Tags */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="flex flex-wrap justify-center gap-3 mb-12"
        >
          {["⚡ Lightning Fast", "🔒 100% Private", "✨ No Login"].map((tag, i) => (
            <motion.div 
              key={i}
              whileHover={{ scale: 1.05, y: -2 }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm backdrop-blur-sm transition-colors duration-300 ${
                isDark
                  ? "bg-slate-800/50 border border-slate-700/50 text-slate-300 hover:bg-slate-800/70"
                  : "bg-white/60 border border-slate-300/50 text-slate-700 hover:bg-white/80"
              }`}
            >
              <span>{tag}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA Button */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12"
        >
          <motion.button
            whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(59, 130, 246, 0.5)" }}
            whileTap={{ scale: 0.95 }}
            onClick={onStartClick}
            className="px-8 py-4 bg-linear-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-lg font-bold text-lg transition-all duration-200 active:scale-95 shadow-2xl shadow-blue-500/30 hover:shadow-blue-500/50 flex items-center gap-2"
          >
            <span>🚀</span>
            <span>Try It Now</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => document.querySelector("#how-it-works").scrollIntoView({ behavior: "smooth" })}
            className={`px-8 py-4 rounded-lg font-bold text-lg transition-all duration-200 border flex items-center gap-2 ${
              isDark
                ? "bg-slate-800/50 hover:bg-slate-800 text-white border-slate-700/50 hover:border-slate-600"
                : "bg-white/50 hover:bg-white text-slate-900 border-slate-300/50 hover:border-slate-400"
            }`}
          >
            <span>📚</span>
            <span>Learn More</span>
          </motion.button>
        </motion.div>

        {/* Scroll Indicator */}
        <div className="flex justify-center animate-bounce">
          <svg className={`w-6 h-6 ${isDark ? "text-slate-400" : "text-slate-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </div>
    </section>
  );
}
