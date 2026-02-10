"use client";

import { motion } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";

export default function Features() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const features = [
    {
      icon: "⚡",
      title: "Lightning Fast",
      description: "Paste a link, download in seconds. No registration, no waiting, no bloat.",
    },
    {
      icon: "🔒",
      title: "100% Private",
      description: "Downloads process locally on your device. No logs, no tracking, no data collection.",
    },
    {
      icon: "🎬",
      title: "Video & Audio",
      description: "Download in HD or convert to MP3. Supports YouTube, Instagram, TikTok, and 100+ platforms.",
    },
    {
      icon: "✨",
      title: "Free Forever",
      description: "No premium plans, no hidden costs. Open source, always free, no limitations ever.",
    },
  ];

  return (
    <section
      id="features"
      className={`py-20 sm:py-32 px-4 transition-colors duration-300 ${
        isDark
          ? "bg-linear-to-b from-slate-900 to-slate-950"
          : "bg-linear-to-b from-slate-50 to-white"
      }`}
    >
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            viewport={{ once: true }}
            className={`text-4xl sm:text-5xl font-black mb-4 ${
              isDark 
                ? "bg-linear-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent" 
                : "bg-linear-to-r from-cyan-600 to-teal-600 bg-clip-text text-transparent"
            }`}
          >
            Why Choose MediaDL
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
            viewport={{ once: true }}
            className={`text-lg max-w-2xl mx-auto ${
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
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
              }}
              whileHover={{ y: -8, transition: { duration: 0.3 } }}
              className={`group p-8 rounded-xl transition-all duration-300 ${
                isDark
                  ? "bg-slate-800/20 border border-cyan-500/20 hover:border-cyan-500/40 hover:bg-slate-800/40 hover:shadow-lg hover:shadow-cyan-500/10"
                  : "bg-white/60 border border-cyan-300/30 hover:border-cyan-400/50 hover:bg-white/80 hover:shadow-lg hover:shadow-cyan-200/30"
              }`}
            >
              {/* Icon */}
              <motion.div 
                whileHover={{ scale: 1.2, rotate: 5 }}
                transition={{ duration: 0.3 }}
                className={`text-5xl mb-4 ${isDark ? "" : ""}`}
              >
                {feature.icon}
              </motion.div>

              {/* Title */}
              <h3 className={`text-xl font-bold mb-3 ${
                isDark ? "text-white" : "text-slate-900"
              }`}>{feature.title}</h3>

              {/* Description */}
              <p className={`text-sm leading-relaxed ${
                isDark ? "text-slate-400" : "text-slate-600"
              }`}>{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
