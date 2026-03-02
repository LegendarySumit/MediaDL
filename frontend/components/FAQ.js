"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(null);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const faqs = [
    {
      question: "Is this legal?",
      answer:
        "MediaDL is a tool—like any tool, it depends how you use it. Personal use downloads are typically legal. You're responsible for respecting copyright laws in your jurisdiction and each platform's Terms of Service. Always verify before downloading.",
    },
    {
      question: "Is my download private?",
      answer:
        "Yes. Downloads process locally on your device. We store nothing—no link history, no activity logs, no tracking. Your privacy is core to MediaDL. No data leaves your device unless absolutely required.",
    },
    {
      question: "What formats and platforms are supported?",
      answer:
        "Video downloads in MP4 (144p to 1080p) and WebM. Audio extracts as MP3. We support YouTube, Instagram, TikTok, Twitter/X, Reddit, Facebook, and 100+ more platforms.",
    },
    {
      question: "Why did my download fail?",
      answer:
        "Most common causes: invalid link, private/deleted video, platform restrictions, or bandwidth issues. Verify the link works in a browser first. Some platforms actively block downloads for legal compliance.",
    },
    {
      question: "Do you store any data about me?",
      answer:
        "No cookies, tracking, analytics, or user profiles. We maintain only standard HTTP logs that auto-purge. We have zero knowledge of your downloads.",
    },
    {
      question: "Can I download copyrighted content?",
      answer:
        "MediaDL doesn't enforce copyright checks—that's your responsibility. Downloading copyrighted material without permission violates most Laws. Use MediaDL only for content you own or have permission to download.",
    },
  ];

  return (
    <section id="faq" className={`py-12 xs:py-16 sm:py-20 md:py-32 px-3 xs:px-4 sm:px-6 transition-colors duration-300 ${
      isDark
        ? "bg-gradient-to-b from-slate-950 to-slate-900"
        : "bg-gradient-to-b from-slate-50 to-white"
    }`}>
      <div className="max-w-3xl mx-auto">
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
                ? "bg-pink-500/15 border-pink-500/30 text-pink-300"
                : "bg-pink-50 border-pink-300/60 text-pink-700"
            }`}>
              <i className="fas fa-circle-question"></i> Common Questions
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
            Frequently Asked Questions
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
            Got questions? We've got answers
          </motion.p>
        </div>

        {/* Accordion */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: {
                staggerChildren: 0.08,
              },
            },
          }}
          className="space-y-3 xs:space-y-4 mb-12"
        >
          {faqs.map((faq, idx) => (
            <motion.div
              key={idx}
              variants={{
                hidden: { opacity: 0, y: 15 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
              }}
              className={`rounded-xl overflow-hidden border-2 transition-all duration-300 backdrop-blur-sm ${
                isDark
                  ? "bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-pink-500/30 hover:border-pink-500/50 hover:bg-gradient-to-br hover:from-slate-800/70 hover:to-slate-900/70"
                  : "bg-gradient-to-br from-white/70 to-slate-50/70 border-pink-300/40 hover:border-pink-400/60 hover:bg-gradient-to-br hover:from-white/90 hover:to-slate-100/70"
              }`}
            >
              {/* Question */}
              <motion.button
                onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                className={`w-full px-5 xs:px-6 sm:px-8 py-4 xs:py-5 flex items-center justify-between transition-colors group`}
              >
                <span className={`text-left font-bold text-base xs:text-lg sm:text-xl pr-3 ${
                  isDark ? "text-white" : "text-slate-900"
                }`}>
                  {faq.question}
                </span>
                <motion.div
                  animate={{ rotate: openIndex === idx ? 180 : 0 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 transition-colors ${
                    isDark 
                      ? "bg-pink-500/20 group-hover:bg-pink-500/30 text-pink-400" 
                      : "bg-pink-100/60 group-hover:bg-pink-200/80 text-pink-600"
                  }`}
                >
                  <i className="fas fa-chevron-down text-sm"></i>
                </motion.div>
              </motion.button>

              {/* Answer */}
              <AnimatePresence>
                {openIndex === idx && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className={`border-t transition-colors duration-300 ${
                      isDark
                        ? "border-pink-500/20 bg-slate-800/30"
                        : "border-pink-300/50 bg-white/50"
                    }`}
                  >
                    <div className="px-5 xs:px-6 sm:px-8 py-5 xs:py-6">
                      <p className={`leading-relaxed text-sm xs:text-base ${
                        isDark ? "text-slate-300" : "text-slate-700"
                      }`}>
                        {faq.answer}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </motion.div>

        {/* Legal Disclaimer */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
          viewport={{ once: true }}
          className={`p-6 xs:p-8 rounded-xl border-2 backdrop-blur-sm transition-all duration-300 ${
            isDark
              ? "bg-gradient-to-br from-pink-950/30 to-rose-950/20 border-pink-500/30 hover:border-pink-500/50"
              : "bg-gradient-to-br from-pink-100/50 to-rose-100/40 border-pink-400/40 hover:border-pink-500/60"
          }`}
        >
          <h3 className={`font-bold mb-3 flex items-center gap-2.5 text-base xs:text-lg ${
            isDark ? "text-white" : "text-slate-900"
          }`}>
            <i className="fas fa-exclamation-triangle text-pink-500"></i>
            Legal Disclaimer
          </h3>
          <p className={`text-sm leading-relaxed ${
            isDark ? "text-slate-300" : "text-slate-700"
          }`}>
            MediaDL is provided as-is for legal purposes only. Users are entirely responsible for
            ensuring their use complies with applicable laws, copyright regulations, and platform
            terms of service. The creators of MediaDL do not endorse or support copyright infringement.
            By using this tool, you accept full legal responsibility for your downloads.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
