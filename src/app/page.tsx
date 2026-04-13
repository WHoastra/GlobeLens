"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { X, Menu, Newspaper, Cloud, Camera, Car, Satellite, Moon, Rocket, Radio } from "lucide-react";
import { LayerToggle, InfoPanel, LoadingOverlay, SearchBar, NewsFeedPanel, LiveStreamPlayer } from "@/components/UI";
import WeatherPanel from "@/components/Panels/WeatherPanel";
import ISSPanelWrapper from "@/components/Panels/ISSPanel";
import ArtemisPanelWrapper from "@/components/Panels/ArtemisPanel";
import WeatherContent from "@/components/Layers/WeatherPanel";
import ISSContent from "@/components/Layers/ISSPanel";
import ArtemisContent from "@/components/Layers/ArtemisPanel";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { LayerState, LayerType, WeatherData, WeatherTileLayerKey, NewsArticle, Webcam, ArtemisViewMode, NewsCategory, NominatimResult, SearchWeatherData } from "@/types";
import { NEWS_CATEGORIES, SATELLITE_CATEGORIES } from "@/types";
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
const ARTEMIS_LIVE_YT = "https://www.youtube.com/embed/m3kR2KK8TEs?autoplay=1";

export default function Home() {
  const { isMobile } = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);
  const [bottomSheet, setBottomSheet] = useState<"info" | "news" | "webcam" | "livefeed" | "iss" | "artemis" | null>(null);

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
  const [showRadar, setShowRadar] = useState(false);
  const [radarTime, setRadarTime] = useState<string>("");
  const [radarPlaying, setRadarPlaying] = useState(false);

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
  const [newsCategories, setNewsCategories] = useState<Set<NewsCategory>>(() => new Set<NewsCategory>(["conflict", "finance", "tech", "politics", "world"]));
  const [newsPanelOpen, setNewsPanelOpen] = useState(false);
  const [newsPanelCategory, setNewsPanelCategory] = useState<NewsCategory | "all">("all");
  const [satelliteTypes, setSatelliteTypes] = useState<Set<string>>(() => new Set(["starlink", "gps", "weather", "station"]));

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
  const [artemisView, setArtemisView] = useState<ArtemisViewMode>("none");


  // Camera distance for navigation buttons
  const [, setCameraDistanceKm] = useState(0);
  const flyToEarthRef = useRef<(() => void) | null>(null);
  const flyToMoonRef = useRef<(() => void) | null>(null);
  const flyToLocationRef = useRef<((lat: number, lon: number, alt: number) => void) | null>(null);
  const setSearchPinRef = useRef<((lat: number, lon: number, label: string) => void) | null>(null);
  const clearSearchPinRef = useRef<(() => void) | null>(null);

  // Search state
  const [searchWeather, setSearchWeather] = useState<SearchWeatherData | null>(null);
  const [searchWeatherLoading, setSearchWeatherLoading] = useState(false);

  const handleToggle = useCallback((layer: LayerType) => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  }, []);

  const handleNewsPanelCategory = useCallback((cat: NewsCategory | "all") => {
    setNewsPanelCategory(cat);
    if (cat === "all") {
      setNewsCategories(new Set<NewsCategory>(["conflict", "finance", "tech", "politics", "world"]));
    } else {
      setNewsCategories(new Set<NewsCategory>([cat]));
    }
  }, []);

  const handleSearchSelect = useCallback((result: NominatimResult) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    const name = result.display_name.split(",").slice(0, 2).join(",").trim();

    // Altitude based on type
    const t = result.type;
    const alt = (t === "country" || t === "state") ? 5_000_000
      : (t === "city" || t === "town") ? 2_000_000
      : (t === "village" || t === "hamlet" || t === "suburb") ? 500_000
      : 100_000;

    flyToLocationRef.current?.(lat, lon, alt);
    setSearchPinRef.current?.(lat, lon, name);

    // Clear other panels
    setSelectedArticle(null);
    setSelectedLocation(null);
    setSelectedWebcam(null);
    setLiveFeed(null);

    // Fetch weather with 7-day forecast
    setSearchWeatherLoading(true);
    setSearchWeather(null);
    fetch(`/api/weather?lat=${lat}&lon=${lon}&forecast=7&name=${encodeURIComponent(name)}`)
      .then((res) => res.json())
      .then((data) => setSearchWeather(data))
      .catch(() => {})
      .finally(() => setSearchWeatherLoading(false));
  }, []);

  const handleSearchClear = useCallback(() => {
    clearSearchPinRef.current?.();
    setSearchWeather(null);
    setSearchWeatherLoading(false);
  }, []);

  const handleGlobeClick = useCallback((event: GlobeClickEvent) => {
    setSelectedLocation({ latitude: event.latitude, longitude: event.longitude });
    setSelectedArticle(null);
    setSelectedWebcam(null);
    setLiveFeed(null);
    clearSearchPinRef.current?.();
    setSearchWeather(null);
    if (isMobile) setBottomSheet("info");
  }, [isMobile]);

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
      setNewsPanelOpen(false);
      return;
    }
    setNewsPanelOpen(true);

    const controller = new AbortController();
    fetch("/api/news", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch news");
        return res.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) return;
        const articles: NewsArticle[] = data.map((a: { title: string; url: string; socialimage: string; domain: string; sourcecountry: string; seendate: string; lat: number; lng: number; location: string; category: string }, i: number) => ({
          id: `news-${i}`,
          title: a.title,
          text: a.title,
          url: a.url,
          image: a.socialimage || undefined,
          source: a.domain,
          publishDate: a.seendate ? `${a.seendate.slice(0,4)}-${a.seendate.slice(4,6)}-${a.seendate.slice(6,8)}` : "",
          latitude: a.lat,
          longitude: a.lng,
          category: (["conflict","finance","tech","politics","world"].includes(a.category) ? a.category : "world") as NewsCategory,
          location: a.location,
        }));
        setNewsArticles(articles);
      })
      .catch(() => {});

    return () => controller.abort();
  }, [layers.news]);

  const handleNewsClick = useCallback((article: NewsArticle) => {
    setSelectedArticle(article);
    setSelectedLocation(null);
    setLiveFeed(null);
    setSelectedWebcam(null);
    if (isMobile) setBottomSheet("news");
  }, [isMobile]);

  const hasActiveData = layers.weather || layers.webcams || layers.news;

  // Filter news articles near the searched location (within ~500km / ~5 degrees)
  const nearbySearchNews = useMemo(() => {
    if (!searchWeather || newsArticles.length === 0) return [];
    const lat = searchWeather.latitude;
    const lon = searchWeather.longitude;
    return newsArticles
      .filter((a) => Math.abs(a.latitude - lat) < 5 && Math.abs(a.longitude - lon) < 5)
      .slice(0, 10);
  }, [searchWeather, newsArticles]);

  return (
    <main className="relative w-screen h-screen">
      {/* 3D Globe — fills entire viewport */}
      <GlobeViewer
        onGlobeClick={handleGlobeClick}
        onStopTracking={handleStopTracking}
        isMobile={isMobile}
        activeWeatherLayers={layers.weather ? activeWeatherLayers : []}
        showTraffic={layers.traffic}
        showRadar={showRadar && layers.weather}
        onRadarTime={setRadarTime}
        radarPlaying={radarPlaying}
        onRadarPlayToggle={() => setRadarPlaying((p) => !p)}
        showSatellites={layers.satellites}
        satelliteTypes={satelliteTypes}
        trackISS={trackISS}
        trackArtemis={trackArtemis}
        showISSOrbit={showISSOrbit && showISS}
        showNews={layers.news}
        newsArticles={newsArticles}
        newsCategories={newsCategories}
        onNewsClick={(article) => handleNewsClick(article)}
        showWebcams={layers.webcams}
        onWebcamClick={(webcam) => { setSelectedWebcam(webcam); setSelectedLocation(null); setLiveFeed(null); setSelectedArticle(null); if (isMobile) setBottomSheet("webcam"); }}
        artemisView={showArtemis ? artemisView : "none"}
        showArtemisActive={showArtemis}
        onCameraDistanceChange={setCameraDistanceKm}
        onFlyToEarth={flyToEarthRef}
        onFlyToMoon={flyToMoonRef}
        onFlyToLocation={flyToLocationRef}
        onSetSearchPin={setSearchPinRef}
        onClearSearchPin={clearSearchPinRef}
        onISSEntityClick={() => { setLiveFeed({ type: "iss", issView: "earth" }); setSelectedWebcam(null); setSelectedArticle(null); if (isMobile) setBottomSheet("livefeed"); }}
        onArtemisEntityClick={() => { setLiveFeed({ type: "artemis", issView: "earth" }); setSelectedWebcam(null); setSelectedArticle(null); if (isMobile) setBottomSheet("livefeed"); }}
        onISSInfo={showISS ? handleISSInfo : undefined}
        onArtemisInfo={showArtemis ? handleArtemisInfo : undefined}
      />

      {/* Layer toggle buttons */}
      <LayerToggle
        layers={layers}
        onToggle={handleToggle}
        activeWeatherLayers={activeWeatherLayers}
        onWeatherLayerToggle={handleWeatherLayerToggle}
        showRadar={showRadar}
        onRadarToggle={() => setShowRadar((p) => !p)}
        newsCategories={newsCategories}
        onNewsCategoryToggle={(cat) => setNewsCategories((prev) => {
          const next = new Set<NewsCategory>(prev);
          if (next.has(cat)) next.delete(cat); else next.add(cat);
          return next;
        })}
        satelliteTypes={satelliteTypes}
        onSatelliteTypeToggle={(type) => setSatelliteTypes((prev) => {
          const next = new Set(prev);
          if (next.has(type)) next.delete(type); else next.add(type);
          return next;
        })}
      />

      {/* Search bar */}
      <SearchBar
        onSelect={handleSearchSelect}
        onClear={handleSearchClear}
        weather={searchWeather}
        weatherLoading={searchWeatherLoading}
        onWeatherClose={handleSearchClear}
        nearbyNews={nearbySearchNews}
        onNewsClick={handleNewsClick}
      />

      {/* Logo / Branding */}
      <div className="absolute top-4 left-4 z-10">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              <span className="text-blue-400">Globe</span>
              <span className="text-white">Lens</span>
            </h1>
            <p className="text-[10px] text-white/40 tracking-widest uppercase">
              Real-time world intelligence
            </p>
          </div>
          <button
            onClick={() => setMenuOpen((p) => !p)}
            className="w-11 h-11 flex items-center justify-center rounded-lg bg-black/50 border border-white/10 text-white/60 md:hidden backdrop-blur-md"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile hamburger menu backdrop */}
        {menuOpen && (
          <div className="fixed inset-0 z-[-1] md:hidden" onClick={() => setMenuOpen(false)} />
        )}
        {/* Mobile hamburger menu — all controls */}
        {menuOpen && (
          <div className="mt-2 p-3 rounded-xl bg-black/80 backdrop-blur-xl border border-white/10 flex flex-col gap-1.5 md:hidden max-h-[70vh] overflow-y-auto w-56">
            <p className="text-[9px] text-white/30 uppercase tracking-wider px-1 mb-1">Layers</p>
            {([
              { label: "News", icon: Newspaper, active: layers.news, onClick: () => handleToggle("news" as LayerType) },
              { label: "Weather", icon: Cloud, active: layers.weather, onClick: () => handleToggle("weather" as LayerType) },
              { label: "Webcams", icon: Camera, active: layers.webcams, onClick: () => handleToggle("webcams" as LayerType) },
              { label: "Traffic", icon: Car, active: layers.traffic, onClick: () => handleToggle("traffic" as LayerType) },
              { label: "Satellites", icon: Satellite, active: layers.satellites, onClick: () => handleToggle("satellites" as LayerType) },
            ]).map(({ label, icon: Icon, active, onClick }) => (
              <button
                key={label}
                onClick={() => { onClick(); }}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all border min-h-[44px] w-full ${
                  active
                    ? "bg-white/15 border-white/30 text-white"
                    : "bg-black/30 border-white/5 text-white/50"
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
            {/* News category filters */}
            {layers.news && (
              <div className="flex flex-wrap gap-1 px-1">
                {NEWS_CATEGORIES.map(({ key, label, color }) => {
                  const active = newsCategories.has(key);
                  return (
                    <button
                      key={key}
                      onClick={() => setNewsCategories((prev) => {
                        const next = new Set<NewsCategory>(prev);
                        if (next.has(key)) next.delete(key); else next.add(key);
                        return next;
                      })}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border transition-all ${
                        active ? "border-white/30 text-white" : "border-white/5 text-white/30"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color, opacity: active ? 1 : 0.3 }} />
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
            {/* Satellite type filters */}
            {layers.satellites && (
              <div className="flex flex-wrap gap-1 px-1">
                {SATELLITE_CATEGORIES.map(({ key, label, color }) => {
                  const active = satelliteTypes.has(key);
                  return (
                    <button
                      key={key}
                      onClick={() => setSatelliteTypes((prev) => {
                        const next = new Set(prev);
                        if (next.has(key)) next.delete(key); else next.add(key);
                        return next;
                      })}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border transition-all ${
                        active ? "border-white/30 text-white" : "border-white/5 text-white/30"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color, opacity: active ? 1 : 0.3 }} />
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="border-t border-white/10 my-1" />
            <p className="text-[9px] text-white/30 uppercase tracking-wider px-1 mb-1">Space Tracking</p>
            <button
              onClick={() => {
                setShowISS((p) => !p);
                if (showISS) { setTrackISS(false); setShowISSOrbit(false); }
                else { setShowISSOrbit(true); if (isMobile) setBottomSheet("iss"); }
                setMenuOpen(false);
              }}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all border min-h-[44px] w-full ${
                showISS
                  ? "bg-yellow-400/20 border-yellow-400/40 text-yellow-300"
                  : "bg-black/30 border-white/5 text-white/50"
              }`}
            >
              <Radio size={16} />
              ISS Tracker
            </button>
            <button
              onClick={() => {
                setShowArtemis((p) => !p);
                if (showArtemis) { setTrackArtemis(false); setArtemisView("none"); }
                else { setArtemisView("lunar-transit"); if (isMobile) setBottomSheet("artemis"); }
                setMenuOpen(false);
              }}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all border min-h-[44px] w-full ${
                showArtemis
                  ? "bg-orange-400/20 border-orange-400/40 text-orange-300"
                  : "bg-black/30 border-white/5 text-white/50"
              }`}
            >
              <Rocket size={16} />
              Artemis II
            </button>
            <Link
              href="/moon"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all border min-h-[44px] w-full bg-black/30 border-white/5 text-white/50"
            >
              <Moon size={16} />
              View Moon
            </Link>
          </div>
        )}

        {/* Desktop nav buttons */}
        <div className="mt-3 hidden md:flex flex-col gap-1.5">
          <Link
            href="/moon"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all backdrop-blur-md border bg-black/30 border-white/10 text-white/50 hover:bg-black/40 hover:text-white/70 min-h-[44px]"
          >
            View Moon
          </Link>
          <button
            onClick={() => {
              setShowISS((p) => !p);
              if (showISS) { setTrackISS(false); setShowISSOrbit(false); }
              else { setShowISSOrbit(true); }
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all backdrop-blur-md border min-h-[44px] ${
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
              if (showArtemis) { setTrackArtemis(false); setArtemisView("none"); }
              else { setArtemisView("lunar-transit"); }
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all backdrop-blur-md border min-h-[44px] ${
              showArtemis
                ? "bg-orange-400/20 border-orange-400/40 text-orange-300 shadow-lg"
                : "bg-black/30 border-white/10 text-white/50 hover:bg-black/40 hover:text-white/70"
            }`}
          >
            Artemis II
          </button>
        </div>
      </div>

      {/* Space tracking panels — bottom-left on desktop, bottom sheet on mobile */}
      {(showArtemis || showISS) && (
        <div className="hidden md:flex absolute bottom-4 left-4 z-10 w-72 flex-col gap-3 max-h-[80vh] overflow-y-auto">
          {/* Artemis II Panel */}
          {showArtemis && (
            <ArtemisPanelWrapper
              artemisInfo={artemisInfo}
              expanded={artemisExpanded}
              onToggleExpand={() => setArtemisExpanded((p) => !p)}
              artemisView={artemisView}
              onViewChange={(view) => setArtemisView(view)}
              trackArtemis={trackArtemis}
              onTrackToggle={() => {
                setTrackArtemis((prev) => !prev);
                if (!trackArtemis) setTrackISS(false);
              }}
            />
          )}

          {/* ISS Panel */}
          {showISS && (
            <ISSPanelWrapper
              issInfo={issInfo}
              issLoading={issLoading}
              expanded={issExpanded}
              onToggleExpand={() => setIssExpanded((p) => !p)}
              showISSOrbit={showISSOrbit}
              onOrbitToggle={() => setShowISSOrbit((p) => !p)}
              trackISS={trackISS}
              onTrackToggle={() => {
                setTrackISS((prev) => !prev);
                if (!trackISS) setTrackArtemis(false);
              }}
            />
          )}
        </div>
      )}

      {/* Info panel — shown when a location is clicked (desktop only) */}
      {!isMobile && selectedLocation && (
        <InfoPanel
          latitude={selectedLocation.latitude}
          longitude={selectedLocation.longitude}
          onClose={() => setSelectedLocation(null)}
        >
          <WeatherPanel
            weather={weather}
            loading={weatherLoading}
            error={weatherError}
            showLayer={layers.weather}
            hasActiveData={hasActiveData}
          />
        </InfoPanel>
      )}

      {/* Webcam popup (desktop only) */}
      {!isMobile && selectedWebcam && (
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
              <X size={14} className="text-white/50" />
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

      {/* Live feed popup (desktop only) */}
      {!isMobile && liveFeed && (
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
              <X size={14} className="text-white/50" />
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
      <div className="absolute bottom-8 md:bottom-16 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        <button
          onClick={() => flyToEarthRef.current?.()}
          className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-full bg-blue-500/20 border border-blue-400/40 text-blue-300 text-xs md:text-sm font-medium backdrop-blur-md hover:bg-blue-500/30 transition-all shadow-lg min-h-[44px]"
        >
          <span className="w-2 h-2 rounded-full bg-blue-400" />
          Back to Earth
        </button>
        <button
          onClick={() => flyToMoonRef.current?.()}
          className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-full bg-gray-500/20 border border-gray-400/40 text-gray-300 text-xs md:text-sm font-medium backdrop-blur-md hover:bg-gray-500/30 transition-all shadow-lg min-h-[44px]"
        >
          <span className="w-2 h-2 rounded-full bg-gray-400" />
          Go to Moon
        </button>
      </div>

      {/* News legend — positioned left of LIVE NEWS panel */}
      {!isMobile && layers.news && newsPanelOpen && newsArticles.length > 0 && (
        <div className="absolute top-16 right-[496px] z-20 flex flex-col gap-1.5">
          {NEWS_CATEGORIES.map(({ key, label, color }) => (
            <div key={key} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/50 backdrop-blur-md border border-white/10">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[10px] text-white/60">{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Attribution + legends — bottom right */}
      <div className="absolute bottom-2 right-3 z-10 flex flex-col items-end gap-1">
        {layers.traffic && (
          <div className="flex gap-2 md:gap-3 px-2 md:px-3 py-1 md:py-1.5 rounded-lg bg-black/50 backdrop-blur-md border border-white/10">
            <span className="text-[8px] md:text-[10px] text-white/40">Traffic:</span>
            {[
              { color: "#00CC00", label: "Free Flow" },
              { color: "#FFCC00", label: "Moderate" },
              { color: "#FF6600", label: "Slow" },
              { color: "#CC0000", label: "Heavy" },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1">
                <span className="w-3 md:w-4 h-1 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-[8px] md:text-[10px] text-white/60">{label}</span>
              </div>
            ))}
          </div>
        )}
        {showRadar && layers.weather && (
          <div className="flex items-center gap-2 px-2 md:px-3 py-1 md:py-1.5 rounded-lg bg-black/50 backdrop-blur-md border border-white/10">
            <button
              onClick={() => setRadarPlaying((p) => !p)}
              className="w-6 h-6 flex items-center justify-center rounded-full bg-purple-500/20 border border-purple-400/40 text-purple-300 text-xs"
            >
              {radarPlaying ? "⏸" : "▶"}
            </button>
            <span className="text-[9px] md:text-[10px] text-purple-300 font-medium">Radar</span>
            {radarTime && (
              <span className="text-[8px] md:text-[10px] text-white/50">{radarTime}</span>
            )}
          </div>
        )}
        <p className="text-[10px] md:text-xs text-white/50 font-medium tracking-wide">
          Created By — Whoastra Labs
        </p>
      </div>

      {/* Live News Feed Panel — desktop only */}
      {!isMobile && layers.news && newsPanelOpen && newsArticles.length > 0 && (
        <NewsFeedPanel
          articles={newsArticles}
          activeCategory={newsPanelCategory}
          onCategoryChange={handleNewsPanelCategory}
          onArticleClick={(article) => {
            setSelectedArticle(article);
            setSelectedLocation(null);
            setSelectedWebcam(null);
            setLiveFeed(null);
          }}
          onClose={() => setNewsPanelOpen(false)}
          selectedArticleId={selectedArticle?.id ?? null}
          flyToLocation={flyToLocationRef.current}
        />
      )}

      {/* Mobile bottom sheet */}
      {isMobile && bottomSheet && (
        <div className="fixed inset-0 z-30 md:hidden">
          <div className="absolute inset-0 bottom-sheet-backdrop bg-black/40" onClick={() => setBottomSheet(null)} />
          <div
            className="absolute bottom-0 left-0 right-0 max-h-[60vh] overflow-y-auto rounded-t-2xl bg-black/80 backdrop-blur-xl border-t border-white/10 bottom-sheet-animate"
            onTouchStart={(e) => {
              const el = e.currentTarget;
              const startY = e.touches[0].clientY;
              const onMove = (ev: TouchEvent) => {
                const dy = ev.touches[0].clientY - startY;
                if (dy > 0) el.style.transform = `translateY(${dy}px)`;
              };
              const onEnd = (ev: TouchEvent) => {
                const dy = ev.changedTouches[0].clientY - startY;
                el.removeEventListener("touchmove", onMove);
                el.removeEventListener("touchend", onEnd);
                if (dy > 80) { setBottomSheet(null); }
                else { el.style.transform = ""; }
              };
              el.addEventListener("touchmove", onMove, { passive: true });
              el.addEventListener("touchend", onEnd);
            }}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-white/30" />
            </div>
            <button
              onClick={() => setBottomSheet(null)}
              className="absolute top-3 right-3 w-11 h-11 flex items-center justify-center rounded-full bg-white/10"
            >
              <X size={20} className="text-white/60" />
            </button>
            <div className="px-4 pb-6">
              {bottomSheet === "info" && selectedLocation && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-white">Location Details</h3>
                  <p className="text-xs text-white/60">{selectedLocation.latitude.toFixed(4)}°N, {selectedLocation.longitude.toFixed(4)}°W</p>
                  {layers.weather && weather && <WeatherContent weather={weather} loading={weatherLoading} error={weatherError} />}
                </div>
              )}
              {bottomSheet === "news" && (
                <div className="space-y-3">
                  <LiveStreamPlayer />
                  {selectedArticle && (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: NEWS_CATEGORIES.find((c) => c.key === selectedArticle.category)?.color || "#fff" }} />
                        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: NEWS_CATEGORIES.find((c) => c.key === selectedArticle.category)?.color || "#fff" }}>
                          {NEWS_CATEGORIES.find((c) => c.key === selectedArticle.category)?.label || selectedArticle.category}
                        </span>
                      </div>
                      <h3 className="text-base font-semibold text-white leading-snug">{selectedArticle.title}</h3>
                      <div className="flex items-center gap-2 text-xs text-white/40">
                        <span>{selectedArticle.source}</span>
                        {selectedArticle.publishDate && (
                          <>
                            <span>·</span>
                            <span>{selectedArticle.publishDate}</span>
                          </>
                        )}
                      </div>
                      {selectedArticle.image && (
                        <img
                          src={selectedArticle.image}
                          alt=""
                          className="w-full max-h-48 object-cover rounded-lg"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      )}
                      <a
                        href={selectedArticle.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center w-full min-h-[48px] px-4 py-3 rounded-xl bg-blue-500/20 border border-blue-400/40 text-blue-300 text-sm font-semibold hover:bg-blue-500/30 transition-colors"
                      >
                        Read Full Article →
                      </a>
                    </>
                  )}
                </div>
              )}
              {bottomSheet === "webcam" && selectedWebcam && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-white">{selectedWebcam.title}</h3>
                  {selectedWebcam.playerUrl ? (
                    <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                      <iframe src={selectedWebcam.playerUrl} className="absolute inset-0 w-full h-full rounded-lg" allowFullScreen />
                    </div>
                  ) : selectedWebcam.previewUrl ? (
                    <img src={selectedWebcam.previewUrl} alt="" className="w-full rounded-lg" />
                  ) : null}
                  <p className="text-xs text-white/50">{selectedWebcam.city}{selectedWebcam.country ? `, ${selectedWebcam.country}` : ""}</p>
                </div>
              )}
              {bottomSheet === "livefeed" && liveFeed && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-white">
                    {liveFeed.type === "iss" ? "ISS Live Feed" : "Artemis II Live"}
                  </h3>
                  <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                    <iframe
                      src={liveFeed.type === "iss"
                        ? (liveFeed.issView === "earth" ? ISS_LIVE_URL : ISS_LIVE_ALT_URL)
                        : ARTEMIS_LIVE_YT}
                      className="absolute inset-0 w-full h-full rounded-lg"
                      allowFullScreen
                    />
                  </div>
                </div>
              )}
              {bottomSheet === "artemis" && showArtemis && (
                <ArtemisContent
                  info={artemisInfo}
                  isTracking={trackArtemis}
                  onTrackToggle={() => {
                    setTrackArtemis((prev) => !prev);
                    if (!trackArtemis) setTrackISS(false);
                  }}
                />
              )}
              {bottomSheet === "iss" && showISS && (
                <ISSContent
                  info={issInfo}
                  loading={issLoading}
                  isTracking={trackISS}
                  onTrackToggle={() => {
                    setTrackISS((prev) => !prev);
                    if (!trackISS) setTrackArtemis(false);
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
