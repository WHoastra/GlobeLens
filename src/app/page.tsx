"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState, useCallback, useEffect, useRef } from "react";
import { LayerToggle, InfoPanel, LoadingOverlay } from "@/components/UI";
import WeatherPanel from "@/components/Layers/WeatherPanel";
import ISSPanel from "@/components/Layers/ISSPanel";
import ArtemisPanel from "@/components/Layers/ArtemisPanel";
import type { LayerState, LayerType, WeatherData, WeatherTileLayerKey, NewsArticle, Webcam } from "@/types";
import type { GlobeClickEvent, ISSInfo, ArtemisInfo } from "@/components/Globe";

// CesiumJS must be loaded client-side only (no SSR)
const GlobeViewer = dynamic(
  () => import("@/components/Globe/GlobeViewer"),
  {
    ssr: false,
    loading: () => <LoadingOverlay />,
  }
);

// ── Live stream URLs (constants for easy updating) ────────────
const ISS_LIVE_URL = "https://video.ibm.com/embed/9408562";
const ISS_LIVE_ALT_URL = "https://video.ibm.com/embed/6540154";
const ARTEMIS_LIVE_YT = "https://www.youtube.com/embed/live_stream?channel=UCLA_DiR1FfKNvjuUpBHmylQ&autoplay=1";

export default function Home() {
  const [layers, setLayers] = useState<LayerState>({
    news: true,
    weather: false,
    webcams: false,
    traffic: false,
    satellites: false,
  });

  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  // Weather state
  const [activeWeatherLayers, setActiveWeatherLayers] = useState<WeatherTileLayerKey[]>(["clouds_new"]);

  const handleWeatherLayerToggle = useCallback((key: WeatherTileLayerKey) => {
    setActiveWeatherLayers((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }, []);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  // News state — fetched globally when News layer is on
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);

  // Webcam state
  const [selectedWebcam, setSelectedWebcam] = useState<Webcam | null>(null);


  // Live feed popup state (ISS / Artemis streams)
  const [liveFeed, setLiveFeed] = useState<{
    type: "iss" | "artemis";
    issView: "earth" | "station";
  } | null>(null);

  // ISS state
  const [issInfo, setISSInfo] = useState<ISSInfo | null>(null);
  const [issLoading, setISSLoading] = useState(true);
  const [trackISS, setTrackISS] = useState(false);

  // Artemis II state
  const [artemisInfo, setArtemisInfo] = useState<ArtemisInfo | null>(null);
  const [trackArtemis, setTrackArtemis] = useState(false);

  // Space tracking — off by default, user must enable
  const [showISS, setShowISS] = useState(false);
  const [showArtemis, setShowArtemis] = useState(false);
  const [issExpanded, setIssExpanded] = useState(true);
  const [artemisExpanded, setArtemisExpanded] = useState(true);

  // Orbit line visibility — off by default
  const [showISSOrbit, setShowISSOrbit] = useState(false);
  const [showArtemisOrbit, setShowArtemisOrbit] = useState(false);


  // Camera distance for navigation buttons
  const [cameraDistanceKm, setCameraDistanceKm] = useState(0);
  const flyToEarthRef = useRef<(() => void) | null>(null);
  const flyToMoonRef = useRef<(() => void) | null>(null);

  const handleToggle = useCallback((layer: LayerType) => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  }, []);

  const handleGlobeClick = useCallback((event: GlobeClickEvent) => {
    setSelectedLocation({ latitude: event.latitude, longitude: event.longitude });
  }, []);

  const handleISSInfo = useCallback((info: ISSInfo | null) => {
    setISSInfo(info);
    setISSLoading(false);
  }, []);

  const handleArtemisInfo = useCallback((info: ArtemisInfo | null) => {
    setArtemisInfo(info);
  }, []);

  const handleStopTracking = useCallback(() => {
    setTrackISS(false);
    setTrackArtemis(false);
  }, []);

  // Fetch weather when location changes and weather layer is on
  useEffect(() => {
    if (!selectedLocation || !layers.weather) {
      setWeather(null);
      return;
    }

    const controller = new AbortController();
    setWeatherLoading(true);
    setWeatherError(null);

    fetch(`/api/weather?lat=${selectedLocation.latitude}&lon=${selectedLocation.longitude}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch weather");
        return res.json();
      })
      .then((data) => setWeather(data))
      .catch((e) => {
        if (e.name !== "AbortError") setWeatherError(e.message);
      })
      .finally(() => setWeatherLoading(false));

    return () => controller.abort();
  }, [selectedLocation, layers.weather]);

  // Fetch geocoded news from /api/news (Claude-geocoded, cached server-side)
  useEffect(() => {
    if (!layers.news) {
      setNewsArticles([]);
      return;
    }

    const controller = new AbortController();
    fetch("/api/news", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch news");
        return res.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) return;
        const articles: NewsArticle[] = data.map((a: { title: string; url: string; socialimage: string; domain: string; sourcecountry: string; seendate: string; lat: number; lng: number; location: string }, i: number) => ({
          id: `news-${i}`,
          title: a.title,
          text: a.title,
          url: a.url,
          image: a.socialimage || undefined,
          source: a.domain,
          publishDate: a.seendate ? `${a.seendate.slice(0,4)}-${a.seendate.slice(4,6)}-${a.seendate.slice(6,8)}` : "",
          latitude: a.lat,
          longitude: a.lng,
          category: a.location,
        }));
        setNewsArticles(articles);
      })
      .catch(() => {});

    return () => controller.abort();
  }, [layers.news]);

  const handleNewsClick = useCallback((article: NewsArticle) => {
    setSelectedArticle(article);
    setLiveFeed(null);
    setSelectedWebcam(null);
  }, []);

  const hasActiveData = layers.weather;

  return (
    <main className="relative w-screen h-screen">
      {/* 3D Globe — fills entire viewport */}
      <GlobeViewer
        onGlobeClick={handleGlobeClick}
        onStopTracking={handleStopTracking}
        activeWeatherLayers={layers.weather ? activeWeatherLayers : []}
        showTraffic={layers.traffic}
        showSatellites={layers.satellites}
        trackISS={trackISS}
        trackArtemis={trackArtemis}
        showISSOrbit={showISSOrbit && showISS}
        showNews={layers.news}
        newsArticles={newsArticles}
        onNewsClick={(article) => handleNewsClick(article)}
        showWebcams={layers.webcams}
        onWebcamClick={(webcam) => { setSelectedWebcam(webcam); setLiveFeed(null); setSelectedArticle(null); }}
        showArtemisOrbit={showArtemisOrbit && showArtemis}
        showArtemisActive={showArtemis}
        onCameraDistanceChange={setCameraDistanceKm}
        onFlyToEarth={flyToEarthRef}
        onFlyToMoon={flyToMoonRef}
        onISSEntityClick={() => { setLiveFeed({ type: "iss", issView: "earth" }); setSelectedWebcam(null); setSelectedArticle(null); }}
        onArtemisEntityClick={() => { setLiveFeed({ type: "artemis", issView: "earth" }); setSelectedWebcam(null); setSelectedArticle(null); }}
        onISSInfo={showISS ? handleISSInfo : undefined}
        onArtemisInfo={showArtemis ? handleArtemisInfo : undefined}
      />

      {/* Layer toggle buttons */}
      <LayerToggle
        layers={layers}
        onToggle={handleToggle}
        activeWeatherLayers={activeWeatherLayers}
        onWeatherLayerToggle={handleWeatherLayerToggle}
      />

      {/* Logo / Branding */}
      <div className="absolute top-4 left-4 z-10">
        <h1 className="text-xl font-bold tracking-tight">
          <span className="text-blue-400">Globe</span>
          <span className="text-white">Lens</span>
        </h1>
        <p className="text-[10px] text-white/40 tracking-widest uppercase">
          Real-time world intelligence
        </p>
        <div className="mt-3 flex flex-col gap-1.5">
          <Link
            href="/moon"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all backdrop-blur-md border bg-black/30 border-white/10 text-white/50 hover:bg-black/40 hover:text-white/70"
          >
            View Moon
          </Link>
          <button
            onClick={() => {
              setShowISS((p) => !p);
              if (showISS) { setTrackISS(false); setShowISSOrbit(false); }
              else { setShowISSOrbit(true); }
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all backdrop-blur-md border ${
              showISS
                ? "bg-yellow-400/20 border-yellow-400/40 text-yellow-300 shadow-lg"
                : "bg-black/30 border-white/10 text-white/50 hover:bg-black/40 hover:text-white/70"
            }`}
          >
            ISS Tracker
          </button>
          <button
            onClick={() => {
              setShowArtemis((p) => !p);
              if (showArtemis) { setTrackArtemis(false); setShowArtemisOrbit(false); }
              else { setShowArtemisOrbit(true); }
            }}
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

      {/* Space tracking panels — bottom-left, only when enabled */}
      {(showArtemis || showISS) && (
        <div className="absolute bottom-4 left-4 z-10 w-72 flex flex-col gap-3 max-h-[80vh] overflow-y-auto">
          {/* Artemis II Panel */}
          {showArtemis && (
            <div className="rounded-xl border border-orange-400/20 bg-black/60 backdrop-blur-xl text-white shadow-2xl">
              <div className="flex items-center justify-between p-4">
                <button
                  onClick={() => setArtemisExpanded((p) => !p)}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                  <h3 className="text-sm font-semibold text-orange-300">Artemis II — Orion</h3>
                  <span className="text-white/30 text-xs">{artemisExpanded ? "▼" : "▶"}</span>
                </button>
                <button
                  onClick={() => setShowArtemisOrbit((p) => !p)}
                  className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                    showArtemisOrbit
                      ? "border-orange-400/40 text-orange-300 bg-orange-400/10"
                      : "border-white/10 text-white/30 hover:text-white/50"
                  }`}
                  title="Toggle orbit line"
                >
                  Orbit
                </button>
              </div>
              {artemisExpanded && (
                <div className="px-4 pb-4">
                  <ArtemisPanel
                    info={artemisInfo}
                    isTracking={trackArtemis}
                    onTrackToggle={() => {
                      setTrackArtemis((prev) => !prev);
                      if (!trackArtemis) setTrackISS(false);
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* ISS Panel */}
          {showISS && (
            <div className="rounded-xl border border-yellow-400/20 bg-black/60 backdrop-blur-xl text-white shadow-2xl">
              <div className="flex items-center justify-between p-4">
                <button
                  onClick={() => setIssExpanded((p) => !p)}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                  <h3 className="text-sm font-semibold text-yellow-300">International Space Station</h3>
                  <span className="text-white/30 text-xs">{issExpanded ? "▼" : "▶"}</span>
                </button>
                <button
                  onClick={() => setShowISSOrbit((p) => !p)}
                  className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                    showISSOrbit
                      ? "border-yellow-400/40 text-yellow-300 bg-yellow-400/10"
                      : "border-white/10 text-white/30 hover:text-white/50"
                  }`}
                  title="Toggle orbit line"
                >
                  Orbit
                </button>
              </div>
              {issExpanded && (
                <div className="px-4 pb-4">
                  <ISSPanel
                    info={issInfo}
                    loading={issLoading}
                    isTracking={trackISS}
                    onTrackToggle={() => {
                      setTrackISS((prev) => !prev);
                      if (!trackISS) setTrackArtemis(false);
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Info panel — shown when a location is clicked */}
      {selectedLocation && (
        <InfoPanel
          latitude={selectedLocation.latitude}
          longitude={selectedLocation.longitude}
          onClose={() => setSelectedLocation(null)}
        >
          <div className="space-y-4">
            {layers.weather && (
              <div>
                <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-2">Weather</h4>
                <WeatherPanel weather={weather} loading={weatherLoading} error={weatherError} />
              </div>
            )}
            {!hasActiveData && (
              <p className="text-sm text-white/40">Enable a layer to see data for this location.</p>
            )}
          </div>
        </InfoPanel>
      )}

      {/* News article panel — shown when a news pin is clicked */}
      {selectedArticle && (
        <div className="absolute bottom-4 left-80 z-10 w-80 rounded-xl border border-red-400/20 bg-black/70 backdrop-blur-xl text-white shadow-2xl p-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <h3 className="text-sm font-semibold leading-snug">{selectedArticle.title}</h3>
            <button
              onClick={() => setSelectedArticle(null)}
              className="p-1 rounded-md hover:bg-white/10 transition-colors shrink-0"
            >
              <span className="text-white/50 text-xs">X</span>
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/40 mb-3">
            <span>{selectedArticle.source}</span>
            {selectedArticle.publishDate && (
              <>
                <span>·</span>
                <span>{selectedArticle.publishDate}</span>
              </>
            )}
            {selectedArticle.category && (
              <>
                <span>·</span>
                <span>{selectedArticle.category}</span>
              </>
            )}
          </div>
          {selectedArticle.image && (
            <img
              src={selectedArticle.image}
              alt=""
              className="w-full h-32 object-cover rounded-lg mb-3"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
          <a
            href={selectedArticle.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Read Full Article →
          </a>
        </div>
      )}

      {/* Webcam popup — shown when a webcam pin is clicked */}
      {selectedWebcam && (
        <div className="absolute bottom-4 left-80 z-20 w-96 rounded-xl border border-cyan-400/20 bg-black/80 backdrop-blur-xl text-white shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-white/10">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
              <h3 className="text-sm font-semibold truncate">{selectedWebcam.title}</h3>
            </div>
            <button
              onClick={() => setSelectedWebcam(null)}
              className="p-1 rounded-md hover:bg-white/10 transition-colors shrink-0 ml-2"
            >
              <span className="text-white/50 text-xs">X</span>
            </button>
          </div>
          {selectedWebcam.playerUrl ? (
            <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
              <iframe
                src={selectedWebcam.playerUrl}
                className="absolute inset-0 w-full h-full"
                allow="autoplay; fullscreen"
                allowFullScreen
                title={selectedWebcam.title}
              />
            </div>
          ) : selectedWebcam.previewUrl ? (
            <img
              src={selectedWebcam.previewUrl}
              alt={selectedWebcam.title}
              className="w-full h-48 object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="w-full h-32 flex items-center justify-center text-white/30 text-sm">
              No preview available
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-white/40">
            {selectedWebcam.city && <span>{selectedWebcam.city}</span>}
            {selectedWebcam.country && (
              <>
                {selectedWebcam.city && <span>·</span>}
                <span>{selectedWebcam.country}</span>
              </>
            )}
            <span className="ml-auto">
              {selectedWebcam.status === "active" ? "Live" : "Offline"}
            </span>
          </div>
        </div>
      )}

      {/* Live feed popup — ISS or Artemis stream */}
      {liveFeed && (
        <div className="absolute bottom-4 left-80 z-20 w-96 rounded-xl border border-yellow-400/20 bg-black/80 backdrop-blur-xl text-white shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-white/10">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`w-2 h-2 rounded-full shrink-0 animate-pulse ${
                liveFeed.type === "iss" ? "bg-yellow-400" : "bg-orange-400"
              }`} />
              <h3 className="text-sm font-semibold truncate">
                {liveFeed.type === "iss"
                  ? `ISS Live Feed — ${liveFeed.issView === "earth" ? "Earth View" : "Station View"}`
                  : "Artemis II — Orion Spacecraft Live"}
              </h3>
            </div>
            <button
              onClick={() => setLiveFeed(null)}
              className="p-1 rounded-md hover:bg-white/10 transition-colors shrink-0 ml-2"
            >
              <span className="text-white/50 text-xs">X</span>
            </button>
          </div>

          {/* ISS view toggle */}
          {liveFeed.type === "iss" && (
            <div className="flex gap-1 px-3 py-2 border-b border-white/5">
              <button
                onClick={() => setLiveFeed({ ...liveFeed, issView: "earth" })}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all border ${
                  liveFeed.issView === "earth"
                    ? "bg-yellow-400/20 border-yellow-400/40 text-yellow-300"
                    : "bg-black/30 border-white/10 text-white/40 hover:text-white/60"
                }`}
              >
                Earth View
              </button>
              <button
                onClick={() => setLiveFeed({ ...liveFeed, issView: "station" })}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all border ${
                  liveFeed.issView === "station"
                    ? "bg-yellow-400/20 border-yellow-400/40 text-yellow-300"
                    : "bg-black/30 border-white/10 text-white/40 hover:text-white/60"
                }`}
              >
                Station View
              </button>
            </div>
          )}

          {/* Video player */}
          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
            <iframe
              key={liveFeed.type === "iss" ? liveFeed.issView : "artemis"}
              src={
                liveFeed.type === "iss"
                  ? liveFeed.issView === "earth" ? ISS_LIVE_URL : ISS_LIVE_ALT_URL
                  : ARTEMIS_LIVE_YT
              }
              className="absolute inset-0 w-full h-full"
              allow="autoplay; fullscreen; encrypted-media"
              allowFullScreen
              title={liveFeed.type === "iss" ? "ISS Live Feed" : "Artemis II Live"}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-3 py-2 text-xs text-white/40">
            <span>{liveFeed.type === "iss" ? "NASA / IBM Video" : "NASA TV"}</span>
            <a
              href="https://www.youtube.com/@NASA/live"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              Watch on YouTube →
            </a>
          </div>
        </div>
      )}

      {/* Navigation buttons — always visible */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        <button
          onClick={() => flyToEarthRef.current?.()}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/20 border border-blue-400/40 text-blue-300 text-sm font-medium backdrop-blur-md hover:bg-blue-500/30 transition-all shadow-lg"
        >
          <span className="w-2 h-2 rounded-full bg-blue-400" />
          Back to Earth
        </button>
        <button
          onClick={() => flyToMoonRef.current?.()}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-500/20 border border-gray-400/40 text-gray-300 text-sm font-medium backdrop-blur-md hover:bg-gray-500/30 transition-all shadow-lg"
        >
          <span className="w-2 h-2 rounded-full bg-gray-400" />
          Go to Moon
        </button>
      </div>

      {/* Attribution */}
      <div className="absolute bottom-2 right-2 z-10">
        <p className="text-[10px] text-white/30 tracking-wide">
          Created By — Whoastra Labs
        </p>
      </div>
    </main>
  );
}
