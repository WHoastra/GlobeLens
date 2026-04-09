"use client";

import { useEffect, useRef, useState } from "react";
import {
  Cartesian3,
  Cartesian2,
  Viewer,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  defined,
  Cartographic,
  Math as CesiumMath,
  UrlTemplateImageryProvider,
  EllipsoidTerrainProvider,
  ImageryLayer,
  JulianDate,
  ClockRange,
  ClockStep,
  Color,
  Ion,
  Transforms,
  Matrix4,
  Moon,
  VerticalOrigin,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { SatelliteManager, ISSInfo, ArtemisInfo } from "@/lib/satelliteManager";
import { NewsRenderer } from "@/lib/newsRenderer";
import { WebcamRenderer } from "@/lib/webcamRenderer";
import { getMoonPositionECEF } from "@/lib/artemis";
import { NewsArticle, NewsCategory, Webcam, WeatherTileLayerKey, ArtemisViewMode } from "@/types";

// Configure Cesium static asset paths
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).CESIUM_BASE_URL = "/cesium";
}

export interface GlobeClickEvent {
  latitude: number;
  longitude: number;
}

interface GlobeViewerProps {
  onGlobeClick?: (event: GlobeClickEvent) => void;
  onStopTracking?: () => void;
  activeWeatherLayers?: WeatherTileLayerKey[];
  showTraffic?: boolean;
  showSatellites?: boolean;
  satelliteTypes?: Set<string>;
  trackISS?: boolean;
  trackArtemis?: boolean;
  showISSOrbit?: boolean;
  artemisView?: ArtemisViewMode;
  isMobile?: boolean;
  showNews?: boolean;
  newsArticles?: NewsArticle[];
  newsCategories?: Set<NewsCategory>;
  onNewsClick?: (article: NewsArticle, lat: number, lon: number) => void;
  showWebcams?: boolean;
  onWebcamClick?: (webcam: Webcam) => void;
  onWebcamsLoaded?: (webcams: Webcam[]) => void;
  showArtemisActive?: boolean;
  onCameraDistanceChange?: (distanceKm: number) => void;
  onFlyToEarth?: React.MutableRefObject<(() => void) | null>;
  onFlyToMoon?: React.MutableRefObject<(() => void) | null>;
  onFlyToLocation?: React.MutableRefObject<((lat: number, lon: number, alt: number) => void) | null>;
  onSetSearchPin?: React.MutableRefObject<((lat: number, lon: number, label: string) => void) | null>;
  onClearSearchPin?: React.MutableRefObject<(() => void) | null>;
  onISSEntityClick?: () => void;
  onArtemisEntityClick?: () => void;
  onISSInfo?: (info: ISSInfo | null) => void;
  onArtemisInfo?: (info: ArtemisInfo | null) => void;
  className?: string;
}

export type { ISSInfo, ArtemisInfo };

export default function GlobeViewer({ onGlobeClick, onStopTracking, activeWeatherLayers = [], showTraffic = false, showSatellites = false, satelliteTypes, trackISS = false, trackArtemis = false, showISSOrbit = true, artemisView = "none", isMobile = false, showNews = false, newsArticles, newsCategories, onNewsClick, showWebcams = false, onWebcamClick, onWebcamsLoaded, showArtemisActive = false, onCameraDistanceChange, onFlyToEarth, onFlyToMoon, onFlyToLocation, onSetSearchPin, onClearSearchPin, onISSEntityClick, onArtemisEntityClick, onISSInfo, onArtemisInfo, className }: GlobeViewerProps) {
  const [cesiumReady, setCesiumReady] = useState(typeof Viewer !== "undefined");
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const weatherLayersRef = useRef<Map<WeatherTileLayerKey, ImageryLayer>>(new Map());
  const trafficLayerRef = useRef<ImageryLayer | null>(null);
  const satManagerRef = useRef<SatelliteManager | null>(null);
  const newsRendererRef = useRef<NewsRenderer | null>(null);
  const webcamRendererRef = useRef<WebcamRenderer | null>(null);
  const onNewsClickRef = useRef(onNewsClick);
  onNewsClickRef.current = onNewsClick;
  const onWebcamClickRef = useRef(onWebcamClick);
  onWebcamClickRef.current = onWebcamClick;
  const onWebcamsLoadedRef = useRef(onWebcamsLoaded);
  onWebcamsLoadedRef.current = onWebcamsLoaded;
  const onISSEntityClickRef = useRef(onISSEntityClick);
  onISSEntityClickRef.current = onISSEntityClick;
  const onArtemisEntityClickRef = useRef(onArtemisEntityClick);
  onArtemisEntityClickRef.current = onArtemisEntityClick;
  const onGlobeClickRef = useRef(onGlobeClick);
  onGlobeClickRef.current = onGlobeClick;
  const onStopTrackingRef = useRef(onStopTracking);
  onStopTrackingRef.current = onStopTracking;
  const orbitingMoonRef = useRef(false);
  const trackArtemisRef = useRef(trackArtemis);
  trackArtemisRef.current = trackArtemis;
  const trackISSRef = useRef(trackISS);
  trackISSRef.current = trackISS;
  const onCameraDistanceChangeRef = useRef(onCameraDistanceChange);
  onCameraDistanceChangeRef.current = onCameraDistanceChange;

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    // Wait for Cesium to be available (loaded via external script tag)
    if (typeof Viewer === "undefined") {
      const check = setInterval(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (typeof window !== "undefined" && (window as any).Cesium) {
          clearInterval(check);
          setCesiumReady(true);
        }
      }, 100);
      return () => clearInterval(check);
    }

    // Set Cesium Ion token for Moon terrain and other assets
    const ionToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
    if (ionToken) {
      Ion.defaultAccessToken = ionToken;
    }

    const viewer = new Viewer(containerRef.current, {
      timeline: false,
      animation: false,
      homeButton: false,
      geocoder: false,
      sceneModePicker: false,
      baseLayerPicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      creditContainer: document.createElement("div"),
      baseLayer: false,
      terrainProvider: new EllipsoidTerrainProvider(),
    });
    viewerRef.current = viewer;

    // Mobile performance tuning
    if (isMobile) {
      viewer.scene.globe.maximumScreenSpaceError = 4;
    }

    // ── Clock: real-time sun position ──────────────────────────
    viewer.clock.currentTime = JulianDate.now();
    viewer.clock.clockRange = ClockRange.UNBOUNDED;
    viewer.clock.clockStep = ClockStep.SYSTEM_CLOCK;
    viewer.clock.shouldAnimate = true;

    // ── Imagery layers ─────────────────────────────────────────

    // 1. Satellite imagery (ArcGIS World Imagery — free, no key)
    viewer.imageryLayers.addImageryProvider(
      new UrlTemplateImageryProvider({
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        maximumLevel: 19,
        credit: "Esri, Maxar, Earthstar Geographics",
      })
    );

    // 2. Night-time Earth lights (NASA Black Marble via ArcGIS)
    const nightLayer = viewer.imageryLayers.addImageryProvider(
      new UrlTemplateImageryProvider({
        url: "https://map1.vis.earthdata.nasa.gov/wmts-webmerc/VIIRS_CityLights_2012/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg",
        maximumLevel: 8,
        credit: "NASA Earth Observatory",
      })
    );
    nightLayer.dayAlpha = 0.0;    // invisible on the sunlit side
    nightLayer.nightAlpha = 0.85; // bright on the dark side
    nightLayer.brightness = 2.5;  // boost city light intensity

    // 3. Labels overlay (borders, country/state/city names)
    viewer.imageryLayers.addImageryProvider(
      new UrlTemplateImageryProvider({
        url: "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        maximumLevel: 19,
        credit: "Esri",
      })
    );

    // 4. Traffic flow heatmap (TomTom — requires API key)
    const tomtomKey = process.env.NEXT_PUBLIC_TOMTOM_API_KEY;
    if (tomtomKey) {
      const trafficProvider = new UrlTemplateImageryProvider({
        url: `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${tomtomKey}&thickness=6`,
        maximumLevel: 18,
        credit: "TomTom",
      });
      const tLayer = viewer.imageryLayers.addImageryProvider(trafficProvider);
      tLayer.alpha = 0.7;
      tLayer.show = false;
      trafficLayerRef.current = tLayer;
    }

    // ── News heatmap + pins ──────────────────────────────────────
    const newsRenderer = new NewsRenderer(viewer, {
      maxClusters: isMobile ? 50 : undefined,
      topBeamCount: isMobile ? 5 : 10,
    });
    newsRenderer.init();
    newsRenderer.setOnArticleClick((article, lat, lon) => {
      onNewsClickRef.current?.(article, lat, lon);
      // Fly to the story location
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(lon, lat, 2_000_000),
        duration: 2,
      });
    });
    newsRenderer.enableClickHandler();
    newsRenderer.setVisible(false); // hidden until News toggle is on
    newsRendererRef.current = newsRenderer;

    // ── Webcam pins ──────────────────────────────────────────────
    const webcamRenderer = new WebcamRenderer(viewer);
    webcamRenderer.init();
    webcamRenderer.setOnWebcamClick((webcam) => {
      onWebcamClickRef.current?.(webcam);
    });
    webcamRenderer.enableClickHandler();
    webcamRenderer.setVisible(false);
    webcamRendererRef.current = webcamRenderer;

    // ── Satellite layer ─────────────────────────────────────────
    const satManager = new SatelliteManager(viewer, {
      maxVisibleSats: isMobile ? 500 : 5000,
    });
    satManagerRef.current = satManager;
    satManager.init(); // async — runs in background

    // ── Globe appearance & lighting ────────────────────────────
    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.showGroundAtmosphere = true;

    // Dark background — no starfield, so satellites stand out
    viewer.scene.backgroundColor = Color.fromCssColorString("#000000");
    if (viewer.scene.skyBox) {
      (viewer.scene.skyBox as any).show = false; // eslint-disable-line @typescript-eslint/no-explicit-any
    }

    // Enable Moon rendering with higher-res 2K texture
    viewer.scene.moon = new Moon({
      textureUrl: "/cesium/Assets/Textures/moon2k.jpg",
    });

    // Dramatic atmosphere
    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.show = true;
      viewer.scene.skyAtmosphere.brightnessShift = 0.2;
    }

    // Fog for depth
    viewer.scene.fog.enabled = true;
    viewer.scene.fog.density = 0.0002;

    // Fade night lights based on camera altitude
    viewer.scene.preRender.addEventListener(() => {
      if (viewer.isDestroyed()) return;
      const height = viewer.camera.positionCartographic.height;
      const minHeight = 500_000;
      const maxHeight = 5_000_000;
      const alpha = Math.max(0, Math.min(1, (height - minHeight) / (maxHeight - minHeight)));
      nightLayer.nightAlpha = alpha * 0.85;
      nightLayer.dayAlpha = 0;
    });

    // ── Camera: static dramatic view showing the terminator ────
    // Position camera to show the day/night boundary (terminator line)
    // by looking at the subsolar point offset by ~90° so the
    // terminator cuts through the center of the view
    const now = new Date();
    const hourAngle = ((now.getUTCHours() + now.getUTCMinutes() / 60) / 24) * 360 - 180;
    // Offset 90° west of the subsolar point to see the terminator
    const terminatorLon = hourAngle - 90;

    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(terminatorLon, 15, 22_000_000),
    });

    // ── Click handler ──────────────────────────────────────────
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((movement: { position: Cartesian2 }) => {
      // Try picking an entity/primitive first (ISS, Artemis)
      const picked = viewer.scene.pick(movement.position);
      if (defined(picked) && satManagerRef.current) {
        const entity = satManagerRef.current.identifyPrimitive(picked);
        if (entity === "iss") {
          onISSEntityClickRef.current?.();
          return;
        }
        if (entity === "artemis") {
          onArtemisEntityClickRef.current?.();
          return;
        }
      }

      const cartesian = viewer.camera.pickEllipsoid(
        movement.position,
        viewer.scene.globe.ellipsoid
      );
      if (defined(cartesian)) {
        const carto = Cartographic.fromCartesian(cartesian);
        const clickLat = CesiumMath.toDegrees(carto.latitude);
        const clickLon = CesiumMath.toDegrees(carto.longitude);

        // Check if a news pin was clicked first
        if (newsRendererRef.current && newsRendererRef.current.tryClick(clickLat, clickLon)) {
          return; // News handled the click — don't fire globe click
        }

        // Stop any space tracking and snap camera to Earth
        if (satManagerRef.current) {
          satManagerRef.current.stopTrackingISS();
          satManagerRef.current.stopTrackingArtemis();
        }
        onStopTrackingRef.current?.();

        onGlobeClickRef.current?.({
          latitude: clickLat,
          longitude: clickLon,
        });
      }
    }, ScreenSpaceEventType.LEFT_CLICK);

    // ── Auto-rotate (only when idle + zoomed out) ──────────────
    const ZOOM_OUT_THRESHOLD = 15_000_000;
    let userInteracting = false;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    const pauseRotation = () => {
      userInteracting = true;
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => { userInteracting = false; }, 3000);
    };

    const canvas = viewer.scene.canvas;
    canvas.addEventListener("pointerdown", pauseRotation);
    canvas.addEventListener("wheel", pauseRotation);

    // Start paused — no spinning on load
    userInteracting = true;
    idleTimer = setTimeout(() => { userInteracting = false; }, 10000);

    const removeListener = viewer.clock.onTick.addEventListener(() => {
      if (viewer.isDestroyed()) return;
      // Don't auto-rotate when orbiting the Moon or tracking Artemis/ISS
      if (orbitingMoonRef.current) return;
      if (trackArtemisRef.current || trackISSRef.current) return;
      const altitude = viewer.camera.positionCartographic.height;
      if (!userInteracting && altitude >= ZOOM_OUT_THRESHOLD) {
        viewer.scene.camera.rotate(Cartesian3.UNIT_Z, 0.001);
      }
    });

    return () => {
      canvas.removeEventListener("pointerdown", pauseRotation);
      canvas.removeEventListener("wheel", pauseRotation);
      if (idleTimer) clearTimeout(idleTimer);
      handler.destroy();
      removeListener();
      if (satManagerRef.current) {
        satManagerRef.current.destroy();
        satManagerRef.current = null;
      }
      if (newsRendererRef.current) {
        newsRendererRef.current.destroy();
        newsRendererRef.current = null;
      }
      if (webcamRendererRef.current) {
        webcamRendererRef.current.destroy();
        webcamRendererRef.current = null;
      }
      if (!viewer.isDestroyed()) viewer.destroy();
      viewerRef.current = null;
      weatherLayersRef.current.clear();
      trafficLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cesiumReady]);

  // Manage OpenWeatherMap tile layers — add/remove as user toggles each sub-layer
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const apiKey = process.env.NEXT_PUBLIC_OPENWEATHERMAP_API_KEY;
    if (!apiKey) {
      console.warn("NEXT_PUBLIC_OPENWEATHERMAP_API_KEY not set — restart dev server after adding it to .env.local");
      return;
    }

    const current = weatherLayersRef.current;
    const activeSet = new Set(activeWeatherLayers);

    // Remove layers that are no longer active
    Array.from(current.entries()).forEach(([key, layer]) => {
      if (!activeSet.has(key)) {
        viewer.imageryLayers.remove(layer, true);
        current.delete(key);
      }
    });

    // Add layers that are newly active
    for (const key of activeWeatherLayers) {
      if (!current.has(key)) {
        const provider = new UrlTemplateImageryProvider({
          url: `https://tile.openweathermap.org/map/${key}/{z}/{x}/{y}.png?appid=${apiKey}`,
          maximumLevel: 18,
          credit: "OpenWeatherMap",
        });
        const layer = viewer.imageryLayers.addImageryProvider(provider);
        layer.alpha = 0.6;
        current.set(key, layer);
      }
    }
  }, [activeWeatherLayers]);

  // Toggle traffic flow layer visibility when showTraffic prop changes
  useEffect(() => {
    if (trafficLayerRef.current) {
      trafficLayerRef.current.show = showTraffic;
    }
  }, [showTraffic]);

  // Toggle news layer visibility
  useEffect(() => {
    if (newsRendererRef.current) {
      newsRendererRef.current.setVisible(showNews);
    }
  }, [showNews]);

  // Render news articles when data changes or viewer becomes ready
  useEffect(() => {
    if (newsRendererRef.current && newsArticles && showNews) {
      if (newsCategories) {
        newsRendererRef.current.setVisibleCategories(newsCategories, newsArticles);
      } else {
        newsRendererRef.current.render(newsArticles);
      }
    }
  }, [newsArticles, showNews, cesiumReady, newsCategories]);

  // Toggle webcam layer visibility + fetch webcams on camera move
  useEffect(() => {
    if (webcamRendererRef.current) {
      webcamRendererRef.current.setVisible(showWebcams);
    }

    if (!showWebcams || !viewerRef.current || viewerRef.current.isDestroyed()) return;

    let fetchTimer: ReturnType<typeof setTimeout> | null = null;
    let lastFetchKey = "";

    const fetchWebcamsForView = () => {
      const cam = webcamRendererRef.current?.getCameraView();
      if (!cam) return;

      // Convert altitude to a reasonable search radius (km)
      // and skip if zoomed out too far (radius > 500km)
      const radiusKm = Math.min(500, Math.max(10, cam.altitude / 5000));
      if (cam.altitude > 5_000_000) {
        webcamRendererRef.current?.render([]);
        return;
      }

      // Dedupe: don't re-fetch if camera hasn't moved significantly
      const key = `${cam.latitude.toFixed(1)},${cam.longitude.toFixed(1)},${radiusKm.toFixed(0)}`;
      if (key === lastFetchKey) return;
      lastFetchKey = key;

      fetch(`/api/webcams?lat=${cam.latitude}&lon=${cam.longitude}&radius=${radiusKm}&limit=50`)
        .then((res) => res.ok ? res.json() : Promise.reject())
        .then((webcams) => {
          if (webcamRendererRef.current) {
            webcamRendererRef.current.render(webcams);
            onWebcamsLoadedRef.current?.(webcams);
          }
        })
        .catch(() => {});
    };

    // Fetch immediately
    fetchWebcamsForView();

    // Re-fetch when camera stops moving (debounced)
    const removeListener = viewerRef.current.camera.moveEnd.addEventListener(() => {
      if (fetchTimer) clearTimeout(fetchTimer);
      fetchTimer = setTimeout(fetchWebcamsForView, 500);
    });

    return () => {
      removeListener();
      if (fetchTimer) clearTimeout(fetchTimer);
    };
  }, [showWebcams]);

  // Artemis deep-space camera constraints + distance reporting + Moon orbit
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const controller = viewer.scene.screenSpaceCameraController;

    if (showArtemisActive) {
      controller.maximumZoomDistance = 1_500_000_000;
    } else {
      controller.maximumZoomDistance = 100_000_000;
    }

    // Report camera distance every time camera moves
    const reportDistance = () => {
      if (viewer.isDestroyed()) return;
      const distKm = Cartesian3.magnitude(viewer.camera.positionWC) / 1000;
      onCameraDistanceChangeRef.current?.(distKm);
    };
    reportDistance();
    const removeListener = viewer.camera.moveEnd.addEventListener(reportDistance);

    // Dynamic orbit pivot: when closer to Moon, orbit around Moon instead of Earth
    let orbitingMoon = false;

    const preRenderListener = showArtemisActive ? () => {
      if (viewer.isDestroyed()) return;

      // Don't switch orbit pivot while actively tracking a spacecraft —
      // the tracking camera.lookAt() in satelliteManager handles it
      if (trackArtemisRef.current || trackISSRef.current) {
        if (orbitingMoon) {
          viewer.camera.lookAtTransform(Matrix4.IDENTITY);
          orbitingMoon = false;
          orbitingMoonRef.current = false;
        }
        return;
      }

      const moonPos = getMoonPositionECEF(new Date());
      const camPos = viewer.camera.positionWC;
      const distToMoon = Cartesian3.distance(camPos, moonPos);
      const distToEarth = Cartesian3.magnitude(camPos);

      const shouldOrbitMoon = distToMoon < distToEarth;

      if (shouldOrbitMoon && !orbitingMoon) {
        // Switch to Moon-centered orbit
        const offset = Cartesian3.subtract(camPos, moonPos, new Cartesian3());
        viewer.camera.lookAtTransform(
          Transforms.eastNorthUpToFixedFrame(moonPos),
          offset
        );
        orbitingMoon = true;
        orbitingMoonRef.current = true;
      } else if (!shouldOrbitMoon && orbitingMoon) {
        // Release back to Earth-centered
        viewer.camera.lookAtTransform(Matrix4.IDENTITY);
        orbitingMoon = false;
        orbitingMoonRef.current = false;
      }
      // When already orbiting Moon, do NOT update transform each frame —
      // it fights with Cesium's camera controller and causes jitter.
      // The Moon moves slowly enough that the initial transform stays accurate.
    } : null;

    if (preRenderListener) {
      viewer.scene.preRender.addEventListener(preRenderListener);
    }

    return () => {
      removeListener();
      if (preRenderListener) {
        viewer.scene.preRender.removeEventListener(preRenderListener);
      }
      // Release Moon orbit transform on cleanup
      if (orbitingMoon && !viewer.isDestroyed()) {
        viewer.camera.lookAtTransform(Matrix4.IDENTITY);
      }
      orbitingMoonRef.current = false;
    };
  }, [showArtemisActive]);

  // Expose fly-to methods via refs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const searchPinRef = useRef<any>(null);

  useEffect(() => {
    if (onFlyToEarth) {
      onFlyToEarth.current = () => satManagerRef.current?.flyToEarth();
    }
    if (onFlyToMoon) {
      onFlyToMoon.current = () => satManagerRef.current?.flyToMoon();
    }
    if (onFlyToLocation) {
      onFlyToLocation.current = (lat: number, lon: number, alt: number) => {
        const viewer = viewerRef.current;
        if (!viewer || viewer.isDestroyed()) return;
        viewer.camera.flyTo({
          destination: Cartesian3.fromDegrees(lon, lat, alt),
          duration: 2,
        });
      };
    }
    if (onSetSearchPin) {
      onSetSearchPin.current = (lat: number, lon: number, label: string) => {
        const viewer = viewerRef.current;
        if (!viewer || viewer.isDestroyed()) return;
        // Remove old pin
        if (searchPinRef.current) viewer.entities.remove(searchPinRef.current);
        searchPinRef.current = viewer.entities.add({
          position: Cartesian3.fromDegrees(lon, lat, 0),
          point: {
            pixelSize: 12,
            color: Color.fromCssColorString("#FF4444"),
            outlineColor: Color.WHITE,
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            text: label.length > 40 ? label.substring(0, 40) + "..." : label,
            font: "bold 13px sans-serif",
            fillColor: Color.WHITE,
            outlineColor: Color.BLACK,
            outlineWidth: 3,
            style: 2,
            verticalOrigin: VerticalOrigin.BOTTOM,
            pixelOffset: new Cartesian2(0, -12),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            backgroundColor: Color.fromCssColorString("rgba(0,0,0,0.6)"),
            showBackground: true,
            backgroundPadding: new Cartesian2(6, 4),
          },
        });
      };
    }
    if (onClearSearchPin) {
      onClearSearchPin.current = () => {
        const viewer = viewerRef.current;
        if (!viewer || viewer.isDestroyed()) return;
        if (searchPinRef.current) {
          viewer.entities.remove(searchPinRef.current);
          searchPinRef.current = null;
        }
      };
    }
    return () => {
      if (onFlyToEarth) onFlyToEarth.current = null;
      if (onFlyToMoon) onFlyToMoon.current = null;
      if (onFlyToLocation) onFlyToLocation.current = null;
      if (onSetSearchPin) onSetSearchPin.current = null;
      if (onClearSearchPin) onClearSearchPin.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onFlyToEarth, onFlyToMoon, onFlyToLocation, onSetSearchPin, onClearSearchPin]);

  // Toggle ISS orbit line
  useEffect(() => {
    if (satManagerRef.current) {
      satManagerRef.current.setISSOrbitVisible(showISSOrbit);
    }
  }, [showISSOrbit]);

  // Switch Artemis trajectory view
  useEffect(() => {
    if (satManagerRef.current) {
      satManagerRef.current.setArtemisView(artemisView);
    }
  }, [artemisView]);

  // Toggle satellite layer visibility
  useEffect(() => {
    if (satManagerRef.current) {
      satManagerRef.current.setVisible(showSatellites);
    }
  }, [showSatellites]);

  // Update satellite type filter
  useEffect(() => {
    if (satManagerRef.current && satelliteTypes) {
      satManagerRef.current.setVisibleTypes(satelliteTypes);
    }
  }, [satelliteTypes]);

  // Toggle ISS tracking
  useEffect(() => {
    if (!satManagerRef.current) return;
    if (trackISS) {
      satManagerRef.current.startTrackingISS();
    } else {
      satManagerRef.current.stopTrackingISS();
    }
  }, [trackISS]);

  // Expose ISS info fetcher via onISSInfo callback
  useEffect(() => {
    if (!onISSInfo || !satManagerRef.current) return;
    satManagerRef.current.getISSInfo().then(onISSInfo);
    // Refresh ISS info every 10 seconds
    const interval = setInterval(() => {
      satManagerRef.current?.getISSInfo().then((info) => onISSInfo(info));
    }, 10000);
    return () => clearInterval(interval);
  }, [onISSInfo]);

  // Toggle Artemis II tracking
  useEffect(() => {
    if (!satManagerRef.current) return;
    if (trackArtemis) {
      satManagerRef.current.startTrackingArtemis();
    } else {
      satManagerRef.current.stopTrackingArtemis();
    }
  }, [trackArtemis]);

  // Expose Artemis II info via callback
  useEffect(() => {
    if (!onArtemisInfo || !satManagerRef.current) return;
    onArtemisInfo(satManagerRef.current.getArtemisInfo());
    const interval = setInterval(() => {
      if (satManagerRef.current) {
        onArtemisInfo(satManagerRef.current.getArtemisInfo());
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [onArtemisInfo]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
    />
  );
}
