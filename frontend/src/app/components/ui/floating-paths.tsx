"use client";

import React, { useMemo } from "react";
import { motion } from "motion/react";
import { cn } from "../../lib/utils";

export function FloatingPathsBackground({
  position,
  children,
  className,
}: {
  position: number;
  className?: string;
  children: React.ReactNode;
}) {
  const paths = useMemo(() => Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${
      380 - i * 5 * position
    } -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${
      152 - i * 5 * position
    } ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${
      684 - i * 5 * position
    } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    color: `rgba(15,23,42,${0.1 + i * 0.03})`,
    width: 0.5 + i * 0.03,
    duration: 20 + (i % 10) + (i * 0.5) 
  })), [position]);

  return (
    <div className={cn("w-full relative overflow-hidden", className)}>
      <div className="absolute inset-0 pointer-events-none">
        <svg
          className="w-full h-full text-blue-500"
          viewBox="0 0 696 316"
          fill="none"
          preserveAspectRatio="xMidYMid slice"
        >
          {paths.map((path) => (
            <motion.path
              key={path.id}
              d={path.d}
              stroke="currentColor"
              strokeWidth={path.width}
              strokeOpacity={0.1 + path.id * 0.03}
              vectorEffect="non-scaling-stroke" // Prevents lag by stopping stroke upscaling on large screens
              initial={{ pathLength: 0.3, opacity: 0.6 }}
              animate={{
                pathLength: 1,
                opacity: [0.3, 0.6, 0.3],
                pathOffset: [0, 1], 
              }}
              transition={{
                duration: path.duration,
                repeat: Number.POSITIVE_INFINITY,
                ease: "linear",
              }}
              // Removed willChange to stop GPU memory exhaustion on full-screen
            />
          ))}
        </svg>
      </div>
      <div className="relative z-10 w-full h-full">
        {children}
      </div>
    </div>
  );
}