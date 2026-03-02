"use client";

import { motion } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";

export default function HowItWorks() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const steps = [
    {
      number: "01",
      icon: "fa-link",
      title: "Paste Your Link",
      description: "Copy a video link from YouTube, Instagram, TikTok, or other supported platforms and paste it.",
    },
    {
      number: "02",
      icon: "fa-sliders",
      title: "Choose Your Format",
      description: "Select video quality, resolution, or extract the audio as MP3. It takes just one click.",
    },
    {
      number: "03",
      icon: "fa-check-circle",
      title: "Download & Done",
      description: "Your file downloads instantly to your device. Completely private, no tracking, no accounts.",
    },
  ];

  return (
    <section
      id="how-it-works"
      className={`py-12 xs:py-16 sm:py-20 md:py-32 px-3 xs:px-4 sm:px-6 transition-colors duration-300 ${
        isDark
          ? "bg-gradient-to-b from-slate-950 to-slate-900"
          : "bg-gradient-to-b from-slate-50 to-white"
      }`}
    >
      <div className="max-w-5xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16 xs:mb-20">
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
                ? "bg-purple-500/15 border-purple-500/30 text-purple-300"
                : "bg-purple-50 border-purple-300/60 text-purple-700"
            }`}>
              <i className="fas fa-layer-group"></i> Simple Process
            </span>
          </motion.div>

          {/* Heading */}
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
            viewport={{ once: true }}
            className={`text-3xl xs:text-4xl sm:text-5xl md:text-6xl font-black mb-4 px-2 ${
              isDark 
                ? "bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent" 
                : "bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent"
            }`}
          >
            How It Works
          </motion.h2>

          {/* Subheading */}
          <motion.p 
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
            viewport={{ once: true }}
            className={`text-sm xs:text-base sm:text-lg px-2 ${
              isDark ? "text-slate-400" : "text-slate-600"
            }`}
          >
            Three simple steps to download your media
          </motion.p>
        </div>

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
          className="grid grid-cols-1 sm:grid-cols-3 gap-6 xs:gap-8"
        >
          {steps.map((step, idx) => (
            <motion.div 
              key={idx} 
              variants={{
                hidden: { opacity: 0, y: 30 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
              }}
            >
              {/* Step Card */}
              <motion.div 
                whileHover={{ y: -6, transition: { duration: 0.3 } }}
                className={`p-6 xs:p-8 rounded-xl border-2 transition-all duration-300 backdrop-blur-sm h-full flex flex-col items-center text-center ${
                  isDark
                    ? "bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-purple-500/30 hover:border-purple-500/50 hover:bg-gradient-to-br hover:from-slate-800/70 hover:to-slate-900/70"
                    : "bg-gradient-to-br from-white/70 to-slate-50/70 border-purple-300/40 hover:border-purple-400/60 hover:bg-gradient-to-br hover:from-white/90 hover:to-slate-100/70"
                }`}
              >
                {/* Number Circle */}
                <motion.div 
                  whileHover={{ scale: 1.1 }}
                  transition={{ duration: 0.3 }}
                  className="inline-flex items-center justify-center w-14 xs:w-16 sm:w-20 h-14 xs:h-16 sm:h-20 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 text-white font-black text-xl xs:text-2xl sm:text-3xl mb-5 xs:mb-6 shadow-lg shadow-purple-600/40"
                >
                  {step.number}
                </motion.div>

                {/* Icon */}
                <div className="text-4xl xs:text-5xl mb-5 xs:mb-6">
                  <i className={`fas ${step.icon} text-purple-500`}></i>
                </div>

                {/* Title */}
                <h3 className={`text-lg xs:text-xl sm:text-2xl font-bold mb-3 xs:mb-4 ${
                  isDark ? "text-white" : "text-slate-900"
                }`}>
                  {step.title}
                </h3>

                {/* Description */}
                <p className={`text-sm xs:text-base leading-relaxed ${
                  isDark ? "text-slate-400" : "text-slate-600"
                }`}>
                  {step.description}
                </p>

                {/* Accent Line */}
                <div className="mt-6 xs:mt-8 w-12 h-1 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"></div>
              </motion.div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
