"use client";

import { motion } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";

export default function Footer() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <footer className={`transition-colors duration-300 py-8 xs:py-10 sm:py-12 px-3 xs:px-4 sm:px-6 ${
      isDark
        ? "bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950"
        : "bg-gradient-to-b from-slate-50 via-white to-slate-50"
    }`}>
      <div className="max-w-7xl mx-auto">
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
          className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-4 xs:gap-6 mb-6 xs:mb-8"
        >
          {/* Branding Column */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
            }}
          >
            <div className="text-lg xs:text-xl sm:text-2xl font-black bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2 xs:mb-3">
              MediaDL
            </div>
            <p className={`text-xs xs:text-sm leading-relaxed mb-4 ${
              isDark ? "text-slate-400" : "text-slate-600"
            }`}>
              Download media privately and instantly. No signup, no tracking, just results.
            </p>
            <div className="flex gap-2 xs:gap-3">
              <a 
                href="https://github.com/LegendarySumit/MediaDL" 
                target="_blank" 
                rel="noopener noreferrer"
                className={`inline-flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-300 ${
                  isDark
                    ? "bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-blue-300"
                    : "bg-slate-200/60 text-slate-600 hover:bg-slate-300 hover:text-blue-600"
                }`}
                title="GitHub"
              >
                <i className="fab fa-github text-lg"></i>
              </a>
              <a 
                href="https://twitter.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className={`inline-flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-300 ${
                  isDark
                    ? "bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-blue-300"
                    : "bg-slate-200/60 text-slate-600 hover:bg-slate-300 hover:text-blue-600"
                }`}
                title="Twitter"
              >
                <i className="fab fa-twitter text-lg"></i>
              </a>
              <a 
                href="https://youtube.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className={`inline-flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-300 ${
                  isDark
                    ? "bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-red-400"
                    : "bg-slate-200/60 text-slate-600 hover:bg-slate-300 hover:text-red-600"
                }`}
                title="YouTube"
              >
                <i className="fab fa-youtube text-lg"></i>
              </a>
              <a 
                href="https://discord.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className={`inline-flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-300 ${
                  isDark
                    ? "bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-purple-300"
                    : "bg-slate-200/60 text-slate-600 hover:bg-slate-300 hover:text-purple-600"
                }`}
                title="Discord"
              >
                <i className="fab fa-discord text-lg"></i>
              </a>
            </div>
          </motion.div>

          {/* Product Links */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
            }}
          >
            <div className="flex items-center gap-1.5 mb-3">
              <i className="fas fa-box text-blue-400 text-base"></i>
              <h4 className={`text-xs xs:text-sm font-bold uppercase tracking-widest ${
                isDark ? "text-white" : "text-slate-900"
              }`}>Product</h4>
            </div>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => document.querySelector("#tool-section").scrollIntoView({ behavior: "smooth" })}
                  className={`text-xs xs:text-sm transition-all duration-300 flex items-center gap-1.5 ${
                    isDark
                      ? "text-slate-400 hover:text-blue-300"
                      : "text-slate-600 hover:text-blue-600"
                  }`}
                >
                  <i className="fas fa-download text-sm"></i>
                  Start Download
                </button>
              </li>
              <li>
                <button
                  onClick={() => document.querySelector("#features").scrollIntoView({ behavior: "smooth" })}
                  className={`text-xs xs:text-sm transition-all duration-300 flex items-center gap-1.5 ${
                    isDark
                      ? "text-slate-400 hover:text-blue-300"
                      : "text-slate-600 hover:text-blue-600"
                  }`}
                >
                  <i className="fas fa-star text-sm"></i>
                  Features
                </button>
              </li>
              <li>
                <button
                  onClick={() => document.querySelector("#how-it-works").scrollIntoView({ behavior: "smooth" })}
                  className={`text-xs xs:text-sm transition-all duration-300 flex items-center gap-1.5 ${
                    isDark
                      ? "text-slate-400 hover:text-blue-300"
                      : "text-slate-600 hover:text-blue-600"
                  }`}
                >
                  <i className="fas fa-question-circle text-sm"></i>
                  How It Works
                </button>
              </li>
            </ul>
          </motion.div>

          {/* Resources */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
            }}
          >
            <div className="flex items-center gap-1.5 mb-3">
              <i className="fas fa-book text-purple-400 text-base"></i>
              <h4 className={`text-xs xs:text-sm font-bold uppercase tracking-widest ${
                isDark ? "text-white" : "text-slate-900"
              }`}>Resources</h4>
            </div>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => document.querySelector("#faq").scrollIntoView({ behavior: "smooth" })}
                  className={`text-xs xs:text-sm transition-all duration-300 flex items-center gap-1.5 ${
                    isDark
                      ? "text-slate-400 hover:text-purple-300"
                      : "text-slate-600 hover:text-purple-600"
                  }`}
                >
                  <i className="fas fa-circle-question text-sm"></i>
                  FAQ
                </button>
              </li>
              <li>
                <a href="/history" className={`text-xs xs:text-sm transition-all duration-300 flex items-center gap-1.5 ${
                  isDark
                    ? "text-slate-400 hover:text-purple-300"
                    : "text-slate-600 hover:text-purple-600"
                }`}>
                  <i className="fas fa-history text-sm"></i>
                  Download History
                </a>
              </li>
            </ul>
          </motion.div>

          {/* Legal */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
            }}
          >
            <div className="flex items-center gap-1.5 mb-3">
              <i className="fas fa-shield-alt text-pink-400 text-base"></i>
              <h4 className={`text-xs xs:text-sm font-bold uppercase tracking-widest ${
                isDark ? "text-white" : "text-slate-900"
              }`}>Legal</h4>
            </div>
            <p className={`text-xs xs:text-sm leading-relaxed mb-3 ${
              isDark ? "text-slate-400" : "text-slate-600"
            }`}>
              MediaDL is a tool for downloading media. Users are responsible for complying with applicable laws and platform terms of service. We do not endorse copyright infringement.
            </p>
          </motion.div>
        </motion.div>

        {/* Bottom Bar */}
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
          className={`border-t pt-5 xs:pt-6 transition-colors duration-300 ${
            isDark ? "border-slate-700/30" : "border-slate-300/50"
          }`}
        >
          <p className={`text-center text-xs xs:text-sm ${
            isDark ? "text-slate-500" : "text-slate-600"
          }`}>
            <span className="inline-flex items-center gap-1">
              <i className="fas fa-heart text-pink-500"></i>
              © 2026 MediaDL. Open source. Privacy first.
            </span>
          </p>
        </motion.div>
      </div>
    </footer>
  );
}
