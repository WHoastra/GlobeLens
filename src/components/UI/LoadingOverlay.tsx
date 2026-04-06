"use client";

export default function LoadingOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0a1a]">
      <div className="relative">
        {/* Spinning ring */}
        <div className="w-16 h-16 rounded-full border-2 border-white/10 border-t-blue-400 animate-spin" />
        {/* Pulsing center dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-blue-400 animate-pulse" />
        </div>
      </div>
      <p className="mt-6 text-sm text-white/60 tracking-wide">Loading GlobeLens...</p>
    </div>
  );
}
