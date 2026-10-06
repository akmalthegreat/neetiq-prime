import React from "react";
import { Sparkles, HeartPulse } from "lucide-react";

interface DrAkzaLoaderProps {
  message?: string;
  text?: string;
  subMessage?: string;
  fullScreen?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function DrAzkaLoader({
  message,
  text,
  subMessage,
  fullScreen = false,
  size = "md",
  className = "",
}: DrAkzaLoaderProps) {
  const imageSizes = {
    sm: "w-24 h-24",
    md: "w-36 h-36 md:w-44 md:h-44",
    lg: "w-48 h-48 md:w-56 md:h-56",
  };

  const displayMessage = message || text || "Dr. Azka is preparing your session...";

  const content = (
    <div className={`relative flex flex-col items-center justify-center text-center p-6 select-none ${className}`}>
      {/* Inline styles for custom scoped high-end keyframes */}
      <style>{`
        @keyframes akza-float {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          30% {
            transform: translateY(-12px) rotate(1.2deg);
          }
          70% {
            transform: translateY(-6px) rotate(-1.2deg);
          }
        }
        @keyframes akza-shadow {
          0%, 100% {
            transform: scale(1);
            opacity: 0.35;
          }
          30% {
            transform: scale(0.78);
            opacity: 0.18;
          }
          70% {
            transform: scale(0.88);
            opacity: 0.24;
          }
        }
        @keyframes akza-spin-cw {
          from {
            transform: translate(-50%, -50%) rotate(0deg);
          }
          to {
            transform: translate(-50%, -50%) rotate(360deg);
          }
        }
        @keyframes akza-spin-ccw {
          from {
            transform: translate(-50%, -50%) rotate(360deg);
          }
          to {
            transform: translate(-50%, -50%) rotate(0deg);
          }
        }
        @keyframes akza-pulse-aura {
          0%, 100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.45;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.18);
            opacity: 0.75;
          }
        }
        @keyframes akza-shimmer-beam {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(200%);
          }
        }
        @keyframes akza-sparkle-float {
          0%, 100% {
            transform: translateY(0px) scale(0.9);
            opacity: 0.5;
          }
          50% {
            transform: translateY(-8px) scale(1.15);
            opacity: 1;
          }
        }
      `}</style>

      {/* Mascot Hero Zone with Multi-Layered Atmosphere */}
      <div className="relative mb-6 flex flex-col items-center">
        {/* Layer 1: Ambient Multi-Chromatic Aurora Glow */}
        <div
          className="absolute top-1/2 left-1/2 w-48 h-48 sm:w-64 sm:h-64 rounded-full bg-gradient-to-tr from-teal-500/35 via-emerald-400/30 to-cyan-500/35 blur-3xl pointer-events-none"
          style={{ animation: "akza-pulse-aura 4s ease-in-out infinite" }}
        />

        {/* Layer 2: Secondary Violet/Sky Atmospheric Rim Light */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 sm:w-52 sm:h-52 rounded-full bg-gradient-to-bl from-blue-500/20 via-purple-500/15 to-transparent blur-2xl pointer-events-none" />

        {/* Layer 3: Outer Science Orbital Ring (Counter-Clockwise) */}
        <div
          className="absolute top-1/2 left-1/2 w-44 h-44 sm:w-56 sm:h-56 rounded-full border border-dashed border-teal-400/30 pointer-events-none"
          style={{
            animation: "akza-spin-ccw 14s linear infinite",
          }}
        >
          {/* Orbital Micro-particle */}
          <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-teal-300 shadow-[0_0_8px_#2dd4bf]" />
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_6px_#67e8f9]" />
        </div>

        {/* Layer 4: Inner Precision Orbital Ring (Clockwise) */}
        <div
          className="absolute top-1/2 left-1/2 w-36 h-36 sm:w-48 sm:h-48 rounded-full border border-emerald-400/25 pointer-events-none"
          style={{
            animation: "akza-spin-cw 9s linear infinite",
            transformOrigin: "center center",
          }}
        >
          {/* Orbiting Satellite Spark */}
          <span className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
        </div>

        {/* Layer 5: Decorative Constellation Sparkles */}
        <div
          className="absolute -top-2 right-2 text-amber-300 pointer-events-none"
          style={{ animation: "akza-sparkle-float 3s ease-in-out infinite" }}
        >
          <Sparkles className="w-5 h-5 drop-shadow-[0_0_6px_rgba(252,211,77,0.8)] fill-amber-300/40" />
        </div>
        <div
          className="absolute top-1/3 -left-4 text-emerald-300 pointer-events-none"
          style={{ animation: "akza-sparkle-float 3.6s ease-in-out infinite 0.8s" }}
        >
          <Sparkles className="w-4 h-4 drop-shadow-[0_0_6px_rgba(110,231,183,0.8)] fill-emerald-300/40" />
        </div>

        {/* Layer 6: Floating Mascot with Smooth Physics Levitation */}
        <div
          className="relative z-10 flex flex-col items-center"
          style={{
            animation: "akza-float 3.4s ease-in-out infinite",
          }}
        >
          <img
            src="/dr-azka.png"
            alt="Dr. Azka Mascot"
            className={`relative z-10 ${imageSizes[size]} object-contain drop-shadow-[0_12px_24px_rgba(16,185,129,0.22)] pointer-events-none select-none transition-transform duration-300`}
          />
        </div>

        {/* Layer 7: Dynamic Synchronized Ground Levitation Shadow */}
        <div
          className="w-24 sm:w-32 h-3.5 bg-black/40 dark:bg-emerald-950/60 rounded-[100%] blur-sm pointer-events-none -mt-1.5"
          style={{
            animation: "akza-shadow 3.4s ease-in-out infinite",
          }}
        />

        {/* Layer 8: Aesthetic Glassmorphism Badge */}
        <div className="relative z-10 mt-3 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 dark:bg-emerald-950/50 backdrop-blur-md text-emerald-700 dark:text-emerald-300 text-xs font-semibold shadow-xs border border-emerald-500/30">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="tracking-wide">Dr. Azka AI Tutor</span>
          <HeartPulse className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
        </div>
      </div>

      {/* Aesthetic Status Text & Progress Bar */}
      <div className="space-y-3 max-w-sm px-2">
        <h3 className="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center justify-center gap-1.5">
          <span>{displayMessage}</span>
          <span className="inline-flex gap-1 ml-1 items-center">
            <span
              className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce"
              style={{ animationDelay: "0ms", animationDuration: "1s" }}
            />
            <span
              className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce"
              style={{ animationDelay: "180ms", animationDuration: "1s" }}
            />
            <span
              className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-bounce"
              style={{ animationDelay: "360ms", animationDuration: "1s" }}
            />
          </span>
        </h3>

        {/* Sleek Energy Beam Progress Indicator */}
        <div className="relative w-48 mx-auto h-1 rounded-full bg-slate-200/80 dark:bg-slate-800/80 overflow-hidden">
          <div
            className="absolute top-0 bottom-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-emerald-400 to-teal-400 rounded-full blur-[0.5px]"
            style={{
              animation: "akza-shimmer-beam 1.8s ease-in-out infinite",
            }}
          />
        </div>

        {subMessage ? (
          <p className="text-xs sm:text-sm text-muted-foreground font-medium">{subMessage}</p>
        ) : (
          <p className="text-[11px] text-muted-foreground/80 tracking-wide font-mono uppercase">
            Syncing NCERT syllabus • Loading high-yield drills
          </p>
        )}
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background/95 backdrop-blur-md z-50">
        {content}
      </div>
    );
  }

  return content;
}

export const DrAkzaLoader = DrAzkaLoader;
