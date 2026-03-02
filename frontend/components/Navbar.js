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
      className={`fixed top-0 left-0 right-0 z-50 backdrop-blur-xl transition-all duration-300 ${
        isDark
          ? "bg-gradient-to-r from-slate-950 via-blue-900/30 to-slate-950 border-b border-blue-500/20"
          : "bg-gradient-to-r from-slate-50 via-blue-50/30 to-slate-50 border-b border-blue-200/40"
      }`}
    >
      <div className="max-w-7xl mx-auto px-3 xs:px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 xs:h-17 relative">
          {/* Logo */}
          <div className="flex items-center gap-1.5 xs:gap-2">
            <div className="text-lg xs:text-xl sm:text-2xl font-black bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              MediaDL
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center absolute left-1/2 -translate-x-1/2 gap-4 lg:gap-6 xl:gap-8">
            {navLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => handleNavClick(link.href)}
                className={`text-xs sm:text-sm lg:text-base transition-colors duration-200 font-medium whitespace-nowrap ${
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
          <div className="flex items-center gap-2.5 xs:gap-3 sm:gap-3.5">
            {/* Theme Toggle Slider */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              onClick={toggleTheme}
              className={`relative w-11 xs:w-12 h-6 rounded-full transition-all duration-300 flex items-center cursor-pointer ${
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
                className={`absolute w-5 h-5 rounded-full shadow-lg flex items-center justify-center transition-colors ${
                  isDark
                    ? "bg-slate-900 left-0.5"
                    : "bg-white right-0.5"
                }`}
              >
                <motion.i
                  key={isDark ? "sun" : "moon"}
                  initial={{ rotate: isDark ? -180 : 180, scale: 0 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className={`fas text-xs ${
                    isDark
                      ? "fa-sun text-yellow-400"
                      : "fa-moon text-slate-700"
                  }`}
                />
              </motion.div>
            </motion.button>

            {/* Start Download Button - Subtle */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onStartClick}
              className="hidden sm:inline-flex items-center justify-center px-3 xs:px-4 sm:px-5 py-1.5 xs:py-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-lg font-semibold text-xs xs:text-sm transition-all duration-200 active:scale-95 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 whitespace-nowrap text-white"
            >
              Start Download
            </motion.button>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={`md:hidden p-1.5 xs:p-2 text-lg xs:text-xl transition-colors duration-200 ${
                isDark
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              aria-label="Toggle menu"
            >
              <i className={`fas ${menuOpen ? "fa-times" : "fa-bars"}`}></i>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className={`md:hidden border-t py-3 xs:py-4 px-3 xs:px-4 animate-slideDown transition-colors duration-300 ${
            isDark
              ? "border-slate-900/50"
              : "border-slate-200"
          }`}>
            {navLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => handleNavClick(link.href)}
                className={`block w-full text-left px-3 xs:px-4 py-2 xs:py-2.5 transition-colors text-sm xs:text-base font-medium rounded-lg ${
                  isDark
                    ? "text-slate-400 hover:text-white hover:bg-slate-800/50"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                {link.label}
              </button>
            ))}
            {/* Mobile Start Download Button */}
            <button
              onClick={() => {
                setMenuOpen(false);
                if (onStartClick) onStartClick();
              }}
              className="sm:hidden w-full mt-3 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-lg font-semibold text-sm transition-all duration-200 active:scale-95 shadow-lg shadow-blue-500/20 text-white"
            >
              Start Download
            </button>
          </div>
        )}
      </div>
    </motion.nav>
  );
}
