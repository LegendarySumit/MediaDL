"use client";

import { motion } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";

export default function Footer() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <footer className={`transition-colors duration-300 py-16 ${
      isDark
        ? "bg-linear-to-b from-slate-900 to-slate-950 border-t border-slate-700/30"
        : "bg-linear-to-b from-slate-100 to-white border-t border-slate-300"
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
          className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12"
        >
          {/* Branding Column */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
            }}
          >
            <div className="text-xl font-black bg-linear-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent mb-3">
              MediaDL
            </div>
            <p className={`text-sm leading-relaxed ${
              isDark ? "text-slate-400" : "text-slate-600"
            }`}>
              Download media privately and instantly. No signup, no tracking, just results.
            </p>
            <div className="flex gap-4 mt-4">
              <a href="#" className={`text-sm transition ${
                isDark
                  ? "text-slate-500 hover:text-slate-300"
                  : "text-slate-600 hover:text-slate-900"
              }`}>
                GitHub
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
            <h4 className={`text-sm font-bold mb-4 uppercase tracking-wider ${
              isDark ? "text-white" : "text-slate-900"
            }`}>Product</h4>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => document.querySelector("#tool-section").scrollIntoView({ behavior: "smooth" })}
                  className={`text-sm transition-colors ${
                    isDark
                      ? "text-slate-400 hover:text-white"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Start Download
                </button>
              </li>
              <li>
                <button
                  onClick={() => document.querySelector("#features").scrollIntoView({ behavior: "smooth" })}
                  className={`text-sm transition-colors ${
                    isDark
                      ? "text-slate-400 hover:text-white"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Features
                </button>
              </li>
              <li>
                <button
                  onClick={() => document.querySelector("#how-it-works").scrollIntoView({ behavior: "smooth" })}
                  className={`text-sm transition-colors ${
                    isDark
                      ? "text-slate-400 hover:text-white"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
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
            <h4 className={`text-sm font-bold mb-4 uppercase tracking-wider ${
              isDark ? "text-white" : "text-slate-900"
            }`}>Resources</h4>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => document.querySelector("#faq").scrollIntoView({ behavior: "smooth" })}
                  className={`text-sm transition-colors ${
                    isDark
                      ? "text-slate-400 hover:text-white"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  FAQ
                </button>
              </li>
              <li>
                <a href="/history" className={`text-sm transition-colors ${
                  isDark
                    ? "text-slate-400 hover:text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}>
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
            <h4 className={`text-sm font-bold mb-4 uppercase tracking-wider ${
              isDark ? "text-white" : "text-slate-900"
            }`}>Legal</h4>
            <p className={`text-xs leading-relaxed mb-4 ${
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
          className={`border-t pt-8 transition-colors duration-300 ${
            isDark ? "border-slate-900/50" : "border-slate-300"
          }`}
        >
          <p className={`text-center text-xs ${
            isDark ? "text-slate-500" : "text-slate-600"
          }`}>
            © 2026 MediaDL. Open source. Privacy first. All rights reserved.
          </p>
        </motion.div>
      </div>
    </footer>
  );
}
