"use client";

import { useRef } from "react";
import { useTheme } from "@/context/ThemeContext";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import ToolSection from "@/components/ToolSection";
import HowItWorks from "@/components/HowItWorks";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";

export default function Home() {
  const toolRef = useRef(null);
  const { theme } = useTheme();

  const handleStartClick = () => {
    toolRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const isDark = theme === "dark";

  return (
    <main className={isDark ? "bg-slate-950 text-white" : "bg-white text-slate-900"}>
      <Navbar onStartClick={handleStartClick} />
      <Hero onStartClick={handleStartClick} />
      <Features />
      <ToolSection toolRef={toolRef} />
      <HowItWorks />
      <FAQ />
      <Footer />
    </main>
  );
}

