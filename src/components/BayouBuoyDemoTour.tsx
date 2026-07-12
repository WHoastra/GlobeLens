"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, SkipForward, Mail, FileText } from "lucide-react";
import type { BuoyNetworkData, BuoyData } from "@/lib/bayouBuoyRenderer";
import type { DemoMode } from "./BayouBuoyHUD";

type FlyTo = (lat: number, lon: number, alt: number, durationS?: number) => void;

interface BayouBuoyDemoTourProps {
  active: boolean;
  onClose: () => void;
  data: BuoyNetworkData | null;
  flyTo: FlyTo | null;
  setMode: (mode: DemoMode) => void;
  setSelectedBuoy: (buoy: BuoyData | null) => void;
}

interface TourStep {
  id: string;
  title: string;
  narration: string;
  action: () => void | Promise<void>;
  durationMs: number;
  isFinal?: boolean;
}

// Center of the Terrebonne Bay – Timbalier Bay system, where the network lives.
const BAY_CENTER = { lat: 29.1, lon: -90.52 };
const DEFAULT_VIEW = { ...BAY_CENTER, alt: 180_000 };

export default function BayouBuoyDemoTour({
  active,
  onClose,
  data,
  flyTo,
  setMode,
  setSelectedBuoy,
}: BayouBuoyDemoTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [captionVisible, setCaptionVisible] = useState(true);

  // Refs so step actions never need to be rebuilt
  const flyToRef = useRef<FlyTo | null>(flyTo);
  flyToRef.current = flyTo;
  const setModeRef = useRef(setMode);
  setModeRef.current = setMode;
  const setSelectedBuoyRef = useRef(setSelectedBuoy);
  setSelectedBuoyRef.current = setSelectedBuoy;
  const dataRef = useRef<BuoyNetworkData | null>(data);
  dataRef.current = data;

  const steps = useMemo<TourStep[]>(() => [
    {
      id: "coast",
      title: "The Coast",
      narration:
        "Coastal Louisiana is losing one football field every 100 minutes. The state has no dense, real-time water intelligence.",
      action: () => {
        setSelectedBuoyRef.current(null);
        setModeRef.current("normal");
        flyToRef.current?.(BAY_CENTER.lat, BAY_CENTER.lon, 280_000, 7);
      },
      durationMs: 8000,
    },
    {
      id: "deploy",
      title: "500 Buoys Deployed",
      narration:
        "BayouBuoy network: 500 autonomous units blanketing the Terrebonne and Timbalier bay system across Terrebonne and Lafourche parishes. ~$850 each. 17 sensors per buoy. Real-time over LTE.",
      action: () => {
        setModeRef.current("normal");
        flyToRef.current?.(BAY_CENTER.lat, BAY_CENTER.lon, 130_000, 9);
      },
      durationMs: 10000,
    },
    {
      id: "salinity",
      title: "Salinity Gradient",
      narration:
        "Watch the freshwater-to-saltwater gradient. Every blue shade is a real measurement, not a model.",
      action: () => {
        setModeRef.current("normal");
        flyToRef.current?.(29.1, -90.65, 70_000, 7);
      },
      durationMs: 8000,
    },
    {
      id: "buoy-detail",
      title: "Single Buoy Detail",
      narration:
        "Click any buoy: 17 measurements, 24-hour history, deployment metadata. State agencies have never had this.",
      action: () => {
        const d = dataRef.current;
        if (d && d.buoys.length > 0) {
          // Pick the buoy nearest the bay center so the close-up always lands mid-network.
          const target = d.buoys.reduce((best, b) =>
            Math.hypot(b.lat - BAY_CENTER.lat, b.lon - BAY_CENTER.lon)
              < Math.hypot(best.lat - BAY_CENTER.lat, best.lon - BAY_CENTER.lon)
              ? b
              : best
          );
          flyToRef.current?.(target.lat, target.lon, 50_000, 4);
          setSelectedBuoyRef.current(target);
        }
      },
      durationMs: 12000,
    },
    {
      id: "spill",
      title: "Spill Detection",
      narration:
        "UV fluorescence catches PAH at parts-per-billion. Three buoys in east Timbalier Bay just flagged a spill drifting in from Belle Pass. Alert latency: under 8 minutes.",
      action: () => {
        setSelectedBuoyRef.current(null);
        setModeRef.current("spill");
        flyToRef.current?.(29.1, -90.24, 50_000, 9);
      },
      durationMs: 10000,
    },
    {
      id: "algal",
      title: "Algal Bloom",
      narration:
        "Chlorophyll fluorescence catches blooms before they're visible from a boat. Critical for oyster farms and public health.",
      action: () => {
        setModeRef.current("algal");
        flyToRef.current?.(29.13, -90.78, 60_000, 7);
      },
      durationMs: 8000,
    },
    {
      id: "hurricane",
      title: "Hurricane Mode",
      narration:
        "Barometric pressure drops 5 mb in 6 hours — every buoy auto-engages 1-minute push interval. Hyper-local storm data inside the storm.",
      action: () => {
        setModeRef.current("hurricane");
        flyToRef.current?.(BAY_CENTER.lat, BAY_CENTER.lon, 220_000, 11);
      },
      durationMs: 12000,
    },
    {
      id: "pitch",
      title: "The Pitch",
      narration:
        "25 buoys Year 1. 100 Year 2. 500 Year 3. $9,500 per unit at pilot. Whoastra Labs — Houma, Louisiana.",
      action: () => {
        setModeRef.current("normal");
        flyToRef.current?.(BAY_CENTER.lat, BAY_CENTER.lon, 300_000, 7);
      },
      durationMs: 8000,
      isFinal: true,
    },
  ], []);

  // Reset to step 0 when tour activates
  useEffect(() => {
    if (active) {
      setCurrentStep(0);
      setPaused(false);
    }
  }, [active]);

  // Run the step action when entering a new step
  useEffect(() => {
    if (!active || currentStep >= steps.length) return;
    const step = steps[currentStep];
    void step.action();
  }, [active, currentStep, steps]);

  // Caption fade on step change
  useEffect(() => {
    if (!active) return;
    setCaptionVisible(false);
    const t = setTimeout(() => setCaptionVisible(true), 250);
    return () => clearTimeout(t);
  }, [currentStep, active]);

  // Auto-advance timer
  useEffect(() => {
    if (!active || paused) return;
    if (currentStep >= steps.length) {
      // Tour ended naturally — close after a brief beat
      const t = setTimeout(() => onClose(), 1500);
      return () => clearTimeout(t);
    }
    const step = steps[currentStep];
    const timer = setTimeout(() => setCurrentStep((s) => s + 1), step.durationMs);
    return () => clearTimeout(timer);
  }, [active, currentStep, paused, steps, onClose]);

  const handleSkip = () => {
    setSelectedBuoyRef.current(null);
    setModeRef.current("normal");
    flyToRef.current?.(DEFAULT_VIEW.lat, DEFAULT_VIEW.lon, DEFAULT_VIEW.alt, 2.5);
    onClose();
  };

  const handlePauseToggle = () => setPaused((p) => !p);

  if (!active) return null;

  const step = steps[Math.min(currentStep, steps.length - 1)];
  const stepNum = Math.min(currentStep + 1, steps.length);
  const progressPct = (stepNum / steps.length) * 100;
  const isFinalCard = step.isFinal && currentStep === steps.length - 1;

  return (
    <>
      {/* Full-screen click-blocker — disables all underlying UI during tour */}
      <div className="fixed inset-0 z-40 cursor-default" aria-hidden="true" />

      {/* Step indicator + progress (top-center) */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-black/85 backdrop-blur-md border border-white/10 text-white shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs tracking-wider">
            <span className="text-cyan-300 font-bold">{stepNum}</span>
            <span className="text-white/40"> / {steps.length}</span>
          </span>
          <div className="w-32 h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-400 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-[10px] uppercase tracking-wider text-white/60">
            {step.title}
          </span>
        </div>
      </div>

      {/* Caption — bottom on desktop, top (below indicator) on mobile */}
      <div
        className={`fixed left-1/2 -translate-x-1/2 z-50 max-w-[calc(100vw-2rem)] md:max-w-2xl
          top-20 md:top-auto md:bottom-24
          transition-opacity duration-300 ${captionVisible ? "opacity-100" : "opacity-0"}`}
      >
        <div className="px-5 md:px-7 py-3 md:py-4 rounded-2xl bg-black/85 backdrop-blur-xl border border-white/15 text-white shadow-2xl text-center">
          <p className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-cyan-300 mb-1">
            {step.title}
          </p>
          <p className="text-sm md:text-base leading-snug">
            {step.narration}
          </p>
        </div>

        {/* Final pitch card */}
        {isFinalCard && (
          <div className="mt-3 px-5 md:px-7 py-4 rounded-2xl bg-gradient-to-br from-cyan-500/15 to-blue-700/20 backdrop-blur-xl border border-cyan-400/30 text-white shadow-2xl text-center">
            <div className="flex items-center justify-center gap-4 flex-wrap text-xs md:text-sm">
              <a
                href="mailto:woody@whoastra.com"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 hover:bg-white/15 transition-colors"
              >
                <Mail size={12} />
                woody@whoastra.com
              </a>
              <a
                href="#whitepaper"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 hover:bg-white/15 transition-colors"
              >
                <FileText size={12} />
                View Whitepaper
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Skip + Pause (bottom-right) */}
      <div className="fixed bottom-4 right-4 z-50 flex gap-2">
        <button
          onClick={handlePauseToggle}
          className="flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg bg-black/85 backdrop-blur-md border border-white/15 text-white/80 hover:text-white hover:bg-black/90 transition-colors text-xs font-semibold shadow-2xl"
        >
          {paused ? <Play size={12} /> : <Pause size={12} />}
          {paused ? "Resume" : "Pause"}
        </button>
        <button
          onClick={handleSkip}
          className="flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg bg-black/85 backdrop-blur-md border border-white/15 text-white/80 hover:text-white hover:bg-black/90 transition-colors text-xs font-semibold shadow-2xl"
        >
          <SkipForward size={12} />
          Skip
        </button>
      </div>
    </>
  );
}
