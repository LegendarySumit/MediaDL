"use client";

import { motion } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";

export default function HowItWorks() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const steps = [
    {
      number: "01",
      icon: "🔗",
      title: "Paste Your Link",
      description: "Copy a video link from YouTube, Instagram, TikTok, or other supported platforms and paste it above.",
    },
    {
      number: "02",
      icon: "⚙️",
      title: "Choose Your Format",
      description: "Select video quality, resolution, or extract the audio as MP3. It takes just one click.",
    },
    {
      number: "03",
      icon: "✅",
      title: "Download & Done",
      description: "Your file downloads instantly to your device. Completely private, no tracking, no accounts.",
    },
  ];

  return (
    <section
      id="how-it-works"
      className={`py-20 sm:py-32 px-4 transition-colors duration-300 ${
        isDark
          ? "bg-linear-to-b from-slate-950 to-slate-900"
          : "bg-linear-to-b from-white to-slate-50"
      }`}
    >
      <div className="max-w-5xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            viewport={{ once: true }}
            className={`text-4xl sm:text-5xl font-black mb-4 ${
              isDark 
                ? "bg-linear-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent" 
                : "bg-linear-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent"
            }`}
          >
            How It Works
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
            viewport={{ once: true }}
            className={`text-lg ${
              isDark ? "text-slate-400" : "text-slate-600"
            }`}
          >
            Three simple steps to get your media
          </motion.p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Steps Grid */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.15,
                },
              },
            }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {steps.map((step, idx) => (
              <motion.div 
                key={idx} 
                variants={{
                  hidden: { opacity: 0, y: 30 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
                }}
                className="relative"
              >
                {/* Step Card */}
                <motion.div 
                  whileHover={{ y: -8, transition: { duration: 0.3 } }}
                  className={`p-8 rounded-xl transition-all duration-300 text-center ${
                    isDark
                      ? "bg-slate-800/20 border border-indigo-500/20 hover:border-indigo-500/40 hover:bg-slate-800/40 hover:shadow-lg hover:shadow-indigo-500/10"
                      : "bg-white/60 border border-indigo-300/30 hover:border-indigo-400/50 hover:bg-white/80 hover:shadow-lg hover:shadow-indigo-200/30"
                  }`}
                >
                  {/* Number Circle */}
                  <motion.div 
                    whileHover={{ scale: 1.15, rotate: 5 }}
                    transition={{ duration: 0.3 }}
                    className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-linear-to-r from-indigo-600 to-purple-600 text-white font-black text-2xl mb-4 shadow-lg shadow-indigo-600/30"
                  >
                    {step.number}
                  </motion.div>

                  {/* Icon */}
                  <div className="text-5xl mb-4">{step.icon}</div>

                  {/* Title */}
                  <h3 className={`text-xl font-bold mb-3 ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}>{step.title}</h3>

                  {/* Description */}
                  <p className={`text-sm leading-relaxed ${
                    isDark ? "text-slate-400" : "text-slate-600"
                  }`}>{step.description}</p>
                </motion.div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
