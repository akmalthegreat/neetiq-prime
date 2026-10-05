import React from "react";
import { Sparkles } from "lucide-react";

interface DrAkzaLoaderProps {
  message?: string;
  subMessage?: string;
  fullScreen?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function DrAkzaLoader({
  message = "Dr. Akza is preparing your session...",
  subMessage,
  fullScreen = false,
  size = "md",
  className = "",
}: DrAkzaLoaderProps) {
  const imageSizes = {
    sm: "w-20 h-20",
    md: "w-32 h-32 md:w-36 md:h-36",
    lg: "w-44 h-44 md:w-52 md:h-52",
  };

  const content = (
    <div className={`flex flex-col items-center justify-center text-center p-6 select-none ${className}`}>
      {/* Avatar Container with pulse glow and float animation */}
      <div className="relative mb-5 group">
        <div className="absolute -inset-2 bg-gradient-to-r from-teal-500/30 via-emerald-500/20 to-cyan-500/30 rounded-full blur-xl animate-pulse" />
        <div
          className={`relative ${imageSizes[size]} rounded-2xl p-1 bg-gradient-to-b from-white/95 to-white/60 dark:from-slate-900/90 dark:to-slate-800/60 shadow-xl border border-teal-500/20 backdrop-blur flex items-center justify-center overflow-hidden transition-transform duration-500`}
        >
          <img
            src="/dr-akza.png"
            alt="Dr. Akza"
            className="w-full h-full object-contain drop-shadow-md animate-bounce"
            style={{ animationDuration: "3s" }}
          />
        </div>

        {/* Name pill badge */}
        <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-0.5 rounded-full bg-emerald-600 dark:bg-emerald-500 text-white text-xs font-semibold shadow-md flex items-center gap-1 border border-white/20">
          <Sparkles className="w-3 h-3 text-amber-300 fill-amber-300" />
          <span>Dr. Akza</span>
        </div>
      </div>

      {/* Dynamic Animated Status Text */}
      <div className="space-y-1.5 max-w-sm">
        <h3 className="text-base md:text-lg font-bold text-foreground tracking-tight flex items-center justify-center gap-1.5">
          <span>{message}</span>
          <span className="inline-flex gap-0.5 ml-0.5">
            <span
              className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce"
              style={{ animationDelay: "150ms" }}
            />
            <span
              className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce"
              style={{ animationDelay: "300ms" }}
            />
          </span>
        </h3>
        {subMessage && (
          <p className="text-xs md:text-sm text-muted-foreground">{subMessage}</p>
        )}
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background/95 backdrop-blur-sm z-50">
        {content}
      </div>
    );
  }

  return content;
}
