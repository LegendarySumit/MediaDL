"use client";

import { motion } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";

export default function Features() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const features = [
    {
      icon: "fa-bolt",
      title: "Lightning Fast",
      description: "Paste a link, download in seconds. No registration, no waiting, no bloat.",
    },
    {
      icon: "fa-lock",
      title: "100% Private",
      description: "Downloads process locally on your device. No logs, no tracking, no data collection.",
    },
    {
      icon: "fa-film",
      title: "Video & Audio",
      description: "Download in HD or convert to MP3. Supports YouTube, Instagram, TikTok, and 100+ platforms.",
    },
    {
      icon: "fa-star",
      title: "Free Forever",
      description: "No premium plans, no hidden costs. Open source, always free, no limitations ever.",
    },
  ];

  return (
    <section
      id="features"
      className={`py-12 xs:py-16 sm:py-20 md:py-32 px-3 xs:px-4 sm:px-6 transition-colors duration-300 ${
        isDark
          ? "bg-linear-to-b from-slate-950 via-slate-900/50 to-slate-950"
          : "bg-linear-to-b from-slate-50/50 to-white"
      }`}
    >
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-10 xs:mb-12 sm:mb-16">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            viewport={{ once: true }}
            className="flex justify-center mb-4"
          >
            <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest border ${
              isDark
                ? "bg-purple-500/10 border-purple-500/30 text-purple-400"
                : "bg-purple-50 border-purple-300/60 text-purple-700"
            }`}>
              <i className="fas fa-star"></i> Our Advantages
            </span>
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
            viewport={{ once: true }}
            className={`text-2xl xs:text-3xl sm:text-4xl md:text-5xl font-black mb-3 xs:mb-4 px-2 ${
              isDark 
                ? "bg-linear-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent" 
                : "bg-linear-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent"
            }`}
          >
            Why Choose MediaDL
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
            viewport={{ once: true }}
            className={`text-sm xs:text-base sm:text-lg max-w-2xl mx-auto px-2 ${
              isDark ? "text-slate-400" : "text-slate-600"
            }`}
          >
            Built for simplicity, powered by reliability
          </motion.p>
        </div>

        {/* Feature Grid */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: {
                staggerChildren: 0.1,
              },
            },
          }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6"
        >
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
              }}
              whileHover={{ y: -6, transition: { duration: 0.3 } }}
              className={`group p-6 xs:p-7 sm:p-8 rounded-2xl backdrop-blur-sm border transition-all duration-300 ${
                isDark
                  ? "bg-slate-800/30 border-purple-500/20 hover:bg-slate-800/50 hover:border-purple-500/40 shadow-lg hover:shadow-purple-500/15"
                  : "bg-white/50 border-purple-300/40 hover:bg-white/75 hover:border-purple-400/60 shadow-lg hover:shadow-purple-300/25"
              }`}
            >
              {/* Icon */}
              <div className={`w-12 h-12 xs:w-14 xs:h-14 rounded-xl mb-4 xs:mb-5 flex items-center justify-center transition-all duration-300 group-hover:scale-110 ${
                isDark
                  ? "bg-linear-to-br from-blue-500 to-purple-500 text-white group-hover:from-blue-600 group-hover:to-purple-600"
                  : "bg-linear-to-br from-blue-200 to-purple-200 text-blue-700 group-hover:from-blue-300 group-hover:to-purple-300"
              }`}>
                <i className={`fas ${feature.icon} text-lg xs:text-xl`}></i>
              </div>

              {/* Title */}
              <h3 className={`text-base xs:text-lg sm:text-lg font-semibold mb-2 xs:mb-3 ${
                isDark ? "text-white" : "text-slate-900"
              }`}>{feature.title}</h3>

              {/* Description */}
              <p className={`text-xs xs:text-sm leading-relaxed ${
                isDark ? "text-slate-400" : "text-slate-600"
              }`}>{feature.description}</p>

              {/* Accent Line */}
              <div className={`mt-4 h-0.5 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 ${
                isDark
                  ? "bg-linear-to-r from-blue-400 via-purple-400 to-pink-400"
                  : "bg-linear-to-r from-blue-500 via-purple-500 to-pink-500"
              }`}></div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
