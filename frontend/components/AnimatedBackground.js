"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";

export default function AnimatedBackground({ isDark = true }) {
  const [particles, setParticles] = useState([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Generate particles only on client after hydration
  useEffect(() => {
    setIsHydrated(true);
    
    const generatedParticles = Array.from({ length: 50 }).map((_, i) => ({
      id: i,
      size: Math.random() * 3 + 1, // 1-4px
      duration: Math.random() * 20 + 15, // 15-35s per cycle
      delay: Math.random() * 5,
      startX: Math.random() * 100,
      startY: Math.random() * 100,
      offsetX: (Math.random() - 0.5) * 100, // -50 to 50
      offsetY: (Math.random() - 0.5) * 100,
      opacity: Math.random() * 0.4 + 0.1, // 0.1-0.5
    }));
    
    setParticles(generatedParticles);
  }, []);

  // Don't render until hydrated to avoid mismatch
  if (!isHydrated) {
    return null;
  }

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 1000 1000"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        {/* Radial gradient for depth */}
        <radialGradient id={isDark ? "particleGradient" : "particleGradientLight"} cx="30%" cy="30%">
          {isDark ? (
            <>
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.3" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#9333ea" stopOpacity="0.35" />
            </>
          )}
        </radialGradient>
      </defs>

      {/* Background blur circles for depth */}
      <g opacity={isDark ? "0.15" : "0.2"}>
        <motion.circle
          cx={200}
          cy={150}
          r="300"
          fill={`url(#${isDark ? "particleGradient" : "particleGradientLight"})`}
          animate={{
            cx: [200, 250, 200],
            cy: [150, 200, 150],
          }}
          transition={{
            duration: 25,
            ease: "linear",
            repeat: Infinity,
          }}
        />
        <motion.circle
          cx={800}
          cy={850}
          r="250"
          fill={`url(#${isDark ? "particleGradient" : "particleGradientLight"})`}
          animate={{
            cx: [800, 750, 800],
            cy: [850, 800, 850],
          }}
          transition={{
            duration: 30,
            ease: "linear",
            repeat: Infinity,
          }}
        />
      </g>

      {/* Animated floating dots */}
      {particles.map((particle) => (
        <motion.g key={particle.id}>
          <motion.circle
            cx={`${particle.startX}%`}
            cy={`${particle.startY}%`}
            r={particle.size}
            fill={isDark ? "#3b82f6" : "#3b82f6"}
            opacity={isDark ? particle.opacity : particle.opacity * 1.2}
            animate={{
              x: [0, particle.offsetX, 0],
              y: [0, particle.offsetY, 0],
            }}
            transition={{
              duration: particle.duration,
              ease: "easeInOut",
              repeat: Infinity,
              delay: particle.delay,
            }}
          />
        </motion.g>
      ))}

      {/* Subtle connecting lines (optional) */}
      <g opacity={isDark ? "0.05" : "0.08"} stroke={isDark ? "#3b82f6" : "#3b82f6"} strokeWidth="0.5">
        <motion.line
          x1="100"
          y1="200"
          x2={400}
          y2="500"
          animate={{
            opacity: [0.05, 0.15, 0.05],
            x2: [400, 450, 400],
          }}
          transition={{
            duration: 8,
            ease: "easeInOut",
            repeat: Infinity,
          }}
        />
        <motion.line
          x1="600"
          y1="300"
          x2={850}
          y2="600"
          animate={{
            opacity: [0.05, 0.12, 0.05],
            x2: [850, 800, 850],
          }}
          transition={{
            duration: 10,
            ease: "easeInOut",
            repeat: Infinity,
          }}
        />
      </g>
    </svg>
  );
}
