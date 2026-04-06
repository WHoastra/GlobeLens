"use client";

import { X } from "lucide-react";
import { formatCoordinates } from "@/lib/geocode";

interface InfoPanelProps {
  latitude: number;
  longitude: number;
  onClose: () => void;
  children?: React.ReactNode;
}

export default function InfoPanel({
  latitude,
  longitude,
  onClose,
  children,
}: InfoPanelProps) {
  return (
    <div className="absolute bottom-4 left-80 z-10 w-80 max-h-[60vh] overflow-y-auto rounded-xl border border-white/20 bg-black/60 backdrop-blur-xl text-white shadow-2xl">
      <div className="sticky top-0 flex items-center justify-between p-4 border-b border-white/10 bg-black/40 backdrop-blur-md">
        <div>
          <h3 className="text-sm font-semibold text-white/90">Location Details</h3>
          <p className="text-xs text-white/50 mt-0.5">
            {formatCoordinates(latitude, longitude)}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-white/10 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
      <div className="p-4">{children ?? <p className="text-sm text-white/40">Click a layer pin for details.</p>}</div>
    </div>
  );
}
