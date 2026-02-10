"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";

export default function Navbar({ onStartClick }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  const navLinks = [
    { label: "Features", href: "#features" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "FAQ", href: "#faq" },
  ];

  const handleNavClick = (href) => {
    setMenuOpen(false);
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <motion.nav 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`fixed top-0 left-0 right-0 z-50 backdrop-blur-md transition-colors duration-300 ${
        isDark
          ? "bg-slate-950 border-b border-slate-900/50"
          : "bg-white border-b border-slate-200"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-17.5">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="text-2xl font-black bg-linear-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              MediaDL
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => handleNavClick(link.href)}
                className={`text-sm transition-colors duration-200 font-medium ${
                  isDark
                    ? "text-slate-400 hover:text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {link.label}
              </button>
            ))}
          </div>

          {/* CTA Button & Theme Toggle */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle Slider */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={toggleTheme}
              className={`relative w-14 h-7 rounded-full transition-all duration-300 flex items-center cursor-pointer ${
                isDark
                  ? "bg-slate-700 border border-slate-600"
                  : "bg-slate-200 border border-slate-300"
              }`}
              title={`Switch to ${isDark ? "light" : "dark"} mode`}
            >
              {/* Sliding Knob */}
              <motion.div
                layout
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 30
                }}
                className={`absolute top-0.5 w-6 h-6 rounded-full shadow-lg flex items-center justify-center ${
                  isDark
                    ? "bg-slate-900 left-0.5"
                    : "bg-white left-7"
                }`}
              >
                <motion.i
                  key={isDark ? "sun" : "moon"}
                  initial={{ rotate: isDark ? -180 : 180, scale: 0 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className={`text-xs ${
                    isDark
                      ? "fas fa-sun text-yellow-400"
                      : "fas fa-moon text-slate-700"
                  }`}
                />
              </motion.div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              onClick={onStartClick}
              className="px-6 py-2 bg-linear-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-lg font-semibold text-sm transition-all duration-200 active:scale-95 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40"
            >
              Start Download
            </motion.button>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={`md:hidden p-2 ${
                isDark
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {menuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className={`md:hidden border-t py-4 px-4 animate-slideDown transition-colors duration-300 ${
            isDark
              ? "border-slate-900/50"
              : "border-slate-200"
          }`}>
            {navLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => handleNavClick(link.href)}
                className={`block w-full text-left px-4 py-2 transition-colors text-sm font-medium ${
                  isDark
                    ? "text-slate-400 hover:text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {link.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.nav>
  );
}
