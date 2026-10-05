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
    sm: "w-24 h-24",
    md: "w-36 h-36 md:w-44 md:h-44",
    lg: "w-48 h-48 md:w-56 md:h-56",
  };

  const content = (
    <div className={`flex flex-col items-center justify-center text-center p-6 select-none ${className}`}>
      {/* Frameless Mascot: Dr. Akza floats freely without clipping or frame box */}
      <div className="relative mb-4 flex flex-col items-center">
        {/* Soft atmospheric ambient glow behind mascot */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 sm:w-52 sm:h-52 bg-gradient-to-tr from-teal-400/30 via-emerald-400/25 to-cyan-400/30 rounded-full blur-3xl pointer-events-none" />

        <img
          src="/dr-akza.png"
          alt="Dr. Akza"
          className={`relative z-10 ${imageSizes[size]} object-contain drop-shadow-xl animate-bounce pointer-events-none select-none`}
          style={{ animationDuration: "3s" }}
        />

        {/* Name pill badge neatly placed below without covering her body or face */}
        <div className="relative z-10 mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white text-xs font-bold shadow-md shadow-emerald-500/20 border border-white/20">
          <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
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
