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
    <section id="faq" className={`py-20 sm:py-32 px-4 transition-colors duration-300 ${
      isDark
        ? "bg-linear-to-b from-slate-900 to-slate-950"
        : "bg-linear-to-b from-slate-50 to-white"
    }`}>
      <div className="max-w-3xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            viewport={{ once: true }}
            className={`text-4xl sm:text-5xl font-black mb-4 ${
              isDark 
                ? "bg-linear-to-r from-pink-400 to-rose-400 bg-clip-text text-transparent" 
                : "bg-linear-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent"
            }`}
          >
            Frequently Asked Questions
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
            Common questions about MediaDL
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
          className="space-y-4"
        >
          {faqs.map((faq, idx) => (
            <motion.div
              key={idx}
              variants={{
                hidden: { opacity: 0, y: 15 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
              }}
              className={`rounded-xl overflow-hidden transition-all duration-300 ${
                isDark
                  ? "border border-pink-500/20 bg-slate-800/20 hover:bg-slate-800/30 hover:border-pink-500/40"
                  : "border border-pink-400/30 bg-white/60 hover:bg-white/80 hover:border-pink-500/50"
              }`}
            >
              {/* Question */}
              <motion.button
                onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                className={`w-full px-6 py-4 flex items-center justify-between transition-colors ${
                  isDark
                    ? "hover:bg-slate-800/50"
                    : "hover:bg-white/40"
                }`}
              >
                <span className={`text-left font-semibold text-lg ${
                  isDark ? "text-white" : "text-slate-900"
                }`}>
                  {faq.question}
                </span>
                <motion.span
                  animate={{ rotate: openIndex === idx ? 180 : 0 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className={`text-xl origin-center ${
                    isDark ? "text-pink-400" : "text-pink-600"
                  }`}
                >
                  <i className="fas fa-chevron-down"></i>
                </motion.span>
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
                        ? "border-pink-500/10 bg-slate-800/20"
                        : "border-pink-300/50 bg-white/40"
                    }`}
                  >
                    <div className="px-6 py-4">
                      <p className={`leading-relaxed text-sm sm:text-base ${
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

        {/* Additional Info */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
          viewport={{ once: true }}
          className={`mt-12 p-6 rounded-xl transition-all duration-300 ${
            isDark
              ? "bg-linear-to-r from-pink-950/20 to-rose-950/20 border border-pink-500/20"
              : "bg-linear-to-r from-pink-100/40 to-rose-100/40 border border-pink-400/40"
          }`}
        >
          <h3 className={`font-bold mb-2 flex items-center gap-2 ${
            isDark ? "text-white" : "text-slate-900"
          }`}>
            <span>⚠️</span>
            Legal Disclaimer
          </h3>
          <p className={`text-sm leading-relaxed ${
            isDark ? "text-slate-400" : "text-slate-700"
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
