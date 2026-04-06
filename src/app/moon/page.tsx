"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState, useEffect } from "react";
import { LoadingOverlay } from "@/components/UI";
import ArtemisPanel from "@/components/Layers/ArtemisPanel";
import type { ArtemisInfo } from "@/lib/satelliteManager";
import {
  getOrionPosition,
  formatMET,
  getMoonDistanceKm,
  ARTEMIS_CREW,
  ARTEMIS_STREAM_URL,
  isMissionActive,
  isMissionComplete,
} from "@/lib/artemis";

const MoonViewer = dynamic(
  () => import("@/components/Globe/MoonViewer"),
  {
    ssr: false,
    loading: () => <LoadingOverlay />,
  }
);

export default function MoonPage() {
  const [artemisInfo, setArtemisInfo] = useState<ArtemisInfo | null>(null);
  const [showArtemis, setShowArtemis] = useState(true);

  // Update Artemis info every 5 seconds
  useEffect(() => {
    function updateArtemis() {
      const orion = getOrionPosition(new Date());
      if (!orion) {
        setArtemisInfo(null);
        return;
      }
      setArtemisInfo({
        phase: orion.phase,
        distanceFromEarthKm: orion.distanceFromEarthKm,
        distanceFromMoonKm: orion.distanceFromMoonKm,
        moonDistanceKm: getMoonDistanceKm(),
        met: formatMET(),
        crew: ARTEMIS_CREW,
        streamUrl: ARTEMIS_STREAM_URL,
        missionActive: isMissionActive(),
        missionComplete: isMissionComplete(),
      });
    }

    updateArtemis();
    const interval = setInterval(updateArtemis, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="relative w-screen h-screen">
      <MoonViewer
        artemisDistanceKm={artemisInfo?.distanceFromMoonKm}
        artemisPhase={artemisInfo?.phase}
      />

      {/* Header */}
      <div className="absolute top-4 left-4 z-10">
        <h1 className="text-xl font-bold tracking-tight">
          <span className="text-gray-300">Globe</span>
          <span className="text-white">Lens</span>
          <span className="text-white/30 text-sm ml-2">/ Moon</span>
        </h1>
        <div className="mt-3 flex flex-col gap-1.5">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all backdrop-blur-md border bg-black/30 border-white/10 text-white/50 hover:bg-black/40 hover:text-white/70"
          >
            Back to Earth
          </Link>
          <button
            onClick={() => setShowArtemis((p) => !p)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all backdrop-blur-md border ${
              showArtemis
                ? "bg-orange-400/20 border-orange-400/40 text-orange-300 shadow-lg"
                : "bg-black/30 border-white/10 text-white/50 hover:bg-black/40 hover:text-white/70"
            }`}
          >
            Artemis II
          </button>
        </div>
      </div>

      {/* Artemis II Panel */}
      {showArtemis && artemisInfo && (
        <div className="absolute bottom-4 left-4 z-10 w-72">
          <div className="rounded-xl border border-orange-400/20 bg-black/60 backdrop-blur-xl text-white shadow-2xl p-4">
            <h3 className="text-sm font-semibold text-orange-300 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
              Artemis II — Orion
            </h3>
            <ArtemisPanel
              info={artemisInfo}
              isTracking={false}
              onTrackToggle={() => {}}
            />
          </div>
        </div>
      )}

      {/* Attribution */}
      <div className="absolute bottom-2 right-2 z-10">
        <p className="text-[10px] text-white/30 tracking-wide">
          Created By — Whoastra Labs
        </p>
      </div>
    </main>
  );
}
