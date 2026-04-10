"use client";

import { useEffect, useRef, useState } from "react";
import {
  Cartesian3,
  Viewer,
  Ion,
  Color,
  Ellipsoid,
  Globe,
  UrlTemplateImageryProvider,
  LabelCollection,
  BillboardCollection,
  PointPrimitiveCollection,
  HorizontalOrigin,
  VerticalOrigin,
  NearFarScalar,
  Cartesian2,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).CESIUM_BASE_URL = "/cesium";
}

const MOON_RADIUS = 1_737_400; // meters

type LunarCategory = "apollo" | "mission" | "crater" | "maria";

const CATEGORY_COLORS: Record<LunarCategory, string> = {
  apollo: "#FFD700",
  mission: "#00CED1",
  crater: "#FFFFFF",
  maria: "#87CEEB",
};

const LUNAR_FEATURES: { name: string; lat: number; lon: number; category: LunarCategory; desc?: string }[] = [
  // Apollo Landing Sites
  { name: "Apollo 11", lat: 0.6744, lon: 23.473, category: "apollo", desc: "1969 — First crewed landing" },
  { name: "Apollo 12", lat: -3.0128, lon: -23.4219, category: "apollo", desc: "1969 — Ocean of Storms" },
  { name: "Apollo 14", lat: -3.6453, lon: -17.4714, category: "apollo", desc: "1971 — Fra Mauro" },
  { name: "Apollo 15", lat: 26.1322, lon: 3.6339, category: "apollo", desc: "1971 — First lunar rover" },
  { name: "Apollo 16", lat: -8.9734, lon: 15.5011, category: "apollo", desc: "1972 — Descartes Highlands" },
  { name: "Apollo 17", lat: 20.1908, lon: 30.7717, category: "apollo", desc: "1972 — Last crewed landing" },

  // Other Mission Landing Sites
  { name: "Luna 2", lat: 29.1, lon: 0.0, category: "mission", desc: "1959 — First Moon impact (USSR)" },
  { name: "Luna 9", lat: 7.13, lon: -64.37, category: "mission", desc: "1966 — First soft landing (USSR)" },
  { name: "Surveyor 1", lat: -2.47, lon: -43.34, category: "mission", desc: "1966 — First US soft landing" },
  { name: "Chang'e 3", lat: 44.12, lon: -19.51, category: "mission", desc: "2013 — China's first lander" },
  { name: "Chang'e 4", lat: -45.46, lon: 177.60, category: "mission", desc: "2019 — First far-side landing" },
  { name: "Chandrayaan-3", lat: -69.37, lon: 32.35, category: "mission", desc: "2023 — India's first landing" },

  // Craters & Geological Features
  { name: "Copernicus", lat: 9.62, lon: -20.08, category: "crater", desc: "93km crater, prominent rays" },
  { name: "Tycho", lat: -43.31, lon: -11.36, category: "crater", desc: "85km crater, bright ray system" },
  { name: "Aristarchus", lat: 23.73, lon: -47.49, category: "crater", desc: "Brightest large crater" },
  { name: "Kepler", lat: 8.12, lon: -38.01, category: "crater", desc: "31km crater with bright rays" },
  { name: "Shackleton", lat: -89.67, lon: 0.0, category: "crater", desc: "South pole, possible ice deposits" },
  { name: "Artemis III Target", lat: -89.45, lon: 0.5, category: "crater", desc: "NASA's planned landing site" },
  { name: "Tsiolkovsky", lat: -21.2, lon: 128.97, category: "crater", desc: "Far side, dark lava floor" },
  { name: "S. Pole-Aitken Basin", lat: -53.0, lon: 169.0, category: "crater", desc: "Largest impact structure, 2500km" },

  // Maria (Seas)
  { name: "Sea of Tranquility", lat: 8.5, lon: 31.4, category: "maria" },
  { name: "Sea of Serenity", lat: 28.0, lon: 17.5, category: "maria" },
  { name: "Ocean of Storms", lat: -18.4, lon: -57.4, category: "maria" },
  { name: "Sea of Crises", lat: 17.0, lon: 59.1, category: "maria" },
  { name: "Sea of Rains", lat: 32.8, lon: -15.6, category: "maria" },
  { name: "Sea of Clouds", lat: -23.0, lon: -9.5, category: "maria" },
];

interface MoonViewerProps {
  artemisDistanceKm?: number;
  artemisPhase?: string;
  className?: string;
}

export default function MoonViewer({ artemisDistanceKm, className }: MoonViewerProps) {
  const [cesiumReady, setCesiumReady] = useState(typeof Viewer !== "undefined");
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const artemisPointsRef = useRef<BillboardCollection | null>(null);
  const artemisIconRef = useRef<string | null>(null);
  const artemisLabelRef = useRef<LabelCollection | null>(null);

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

    const ionToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
    if (ionToken) {
      Ion.defaultAccessToken = ionToken;
    }

    // Create ellipsoid here (not at module scope) to ensure Cesium is loaded
    const MOON_ELLIPSOID = new Ellipsoid(MOON_RADIUS, MOON_RADIUS, MOON_RADIUS);

    // Create viewer with Moon-sized ellipsoid
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
      globe: new Globe(MOON_ELLIPSOID),
    });
    viewerRef.current = viewer;

    // Style
    viewer.scene.backgroundColor = Color.fromCssColorString("#000000");
    if (viewer.scene.skyBox) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (viewer.scene.skyBox as any).show = false;
    }
    viewer.scene.globe.enableLighting = false;
    viewer.scene.globe.showGroundAtmosphere = false;
    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.show = false;
    }

    // Add NASA lunar imagery (LROC WAC global mosaic)
    viewer.imageryLayers.addImageryProvider(
      new UrlTemplateImageryProvider({
        url: "https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{z}/{y}/{x}.jpg",
        maximumLevel: 8,
        credit: "NASA/GSFC/Arizona State University",
        ellipsoid: MOON_ELLIPSOID,
      })
    );

    // Camera controls — enable zoom and rotation
    const controller = viewer.scene.screenSpaceCameraController;
    controller.enableZoom = true;
    controller.enableRotate = true;
    controller.enableTilt = true;
    controller.enableLook = true;
    controller.minimumZoomDistance = 10_000;      // 10km from surface
    controller.maximumZoomDistance = 20_000_000;   // 20,000km out

    // Start with a nice view of the Moon
    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(20, 5, 5_000_000, MOON_ELLIPSOID),
    });

    // Auto-rotate the moon slowly
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

    const removeRotateListener = viewer.clock.onTick.addEventListener(() => {
      if (viewer.isDestroyed()) return;
      if (!userInteracting) {
        viewer.scene.camera.rotate(Cartesian3.UNIT_Z, 0.0005);
      }
    });

    // Add lunar feature pins + labels
    const pins = viewer.scene.primitives.add(
      new PointPrimitiveCollection()
    ) as PointPrimitiveCollection;

    const labels = viewer.scene.primitives.add(
      new LabelCollection()
    ) as LabelCollection;

    for (const f of LUNAR_FEATURES) {
      const color = Color.fromCssColorString(CATEGORY_COLORS[f.category]);
      const isLanding = f.category === "apollo" || f.category === "mission";
      const pinSize = isLanding ? 12 : 8;

      // Colored pin
      pins.add({
        position: Cartesian3.fromDegrees(f.lon, f.lat, 500, MOON_ELLIPSOID),
        pixelSize: pinSize,
        color: color,
        outlineColor: Color.WHITE,
        outlineWidth: 2,
        scaleByDistance: new NearFarScalar(5e4, 2.0, 5e6, 0.6),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        show: true,
      });

      // Label — bright white text on dark background for readability
      const labelText = f.desc ? `${f.name} — ${f.desc}` : f.name;
      labels.add({
        position: Cartesian3.fromDegrees(f.lon, f.lat, 2000, MOON_ELLIPSOID),
        text: labelText,
        font: isLanding ? "bold 14px sans-serif" : "bold 13px sans-serif",
        fillColor: Color.WHITE,
        outlineColor: Color.BLACK,
        outlineWidth: 4,
        style: 2,
        horizontalOrigin: HorizontalOrigin.LEFT,
        verticalOrigin: VerticalOrigin.CENTER,
        pixelOffset: new Cartesian2(12, 0),
        scaleByDistance: new NearFarScalar(5e4, 1.2, 5e6, 0.4),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        backgroundColor: Color.fromCssColorString("rgba(0,0,0,0.7)"),
        showBackground: true,
        backgroundPadding: new Cartesian2(6, 3),
        show: true,
      });
    }

    // Artemis spaceship billboard + label collections
    const aBillboards = viewer.scene.primitives.add(
      new BillboardCollection()
    ) as BillboardCollection;
    artemisPointsRef.current = aBillboards;

    // Create Artemis spaceship icon for Moon view
    const iconCanvas = document.createElement("canvas");
    iconCanvas.width = 56;
    iconCanvas.height = 56;
    const ctx = iconCanvas.getContext("2d")!;
    const cx = 28, cy = 28, s = 56 / 48;
    ctx.shadowColor = "#FF6B00";
    ctx.shadowBlur = 10 * s;
    ctx.fillStyle = "#FF8C00";
    ctx.beginPath();
    ctx.moveTo(cx, cy - 20 * s);
    ctx.lineTo(cx + 6 * s, cy - 4 * s);
    ctx.lineTo(cx + 8 * s, cy + 6 * s);
    ctx.lineTo(cx + 14 * s, cy + 16 * s);
    ctx.lineTo(cx + 6 * s, cy + 12 * s);
    ctx.lineTo(cx + 3 * s, cy + 18 * s);
    ctx.lineTo(cx, cy + 14 * s);
    ctx.lineTo(cx - 3 * s, cy + 18 * s);
    ctx.lineTo(cx - 6 * s, cy + 12 * s);
    ctx.lineTo(cx - 14 * s, cy + 16 * s);
    ctx.lineTo(cx - 8 * s, cy + 6 * s);
    ctx.lineTo(cx - 6 * s, cy - 4 * s);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#FFFFFF";
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 8 * s, 2.5 * s, 4 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = "#88DDFF";
    ctx.shadowColor = "#88DDFF";
    ctx.shadowBlur = 6 * s;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 15 * s, 3 * s, 2 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 0;
    artemisIconRef.current = iconCanvas.toDataURL();

    const aLabels = viewer.scene.primitives.add(
      new LabelCollection()
    ) as LabelCollection;
    artemisLabelRef.current = aLabels;

    return () => {
      removeRotateListener();
      canvas.removeEventListener("pointerdown", pauseRotation);
      canvas.removeEventListener("wheel", pauseRotation);
      if (!viewer.isDestroyed()) viewer.destroy();
      viewerRef.current = null;
      artemisPointsRef.current = null;
      artemisLabelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cesiumReady]);

  // Update Artemis position relative to Moon
  useEffect(() => {
    if (!artemisPointsRef.current || !artemisLabelRef.current) return;
    if (artemisDistanceKm === undefined) return;

    artemisPointsRef.current.removeAll();
    artemisLabelRef.current.removeAll();

    // Position Orion above the Moon — place it along the +X axis at the correct distance
    const distMeters = artemisDistanceKm * 1000;
    const pos = new Cartesian3(distMeters, 0, 0);

    const pulse = 0.8 + Math.sin(Date.now() / 300) * 0.15;
    artemisPointsRef.current.add({
      position: pos,
      image: artemisIconRef.current!,
      scale: pulse,
      show: true,
      scaleByDistance: new NearFarScalar(1e5, 1.5, 1e7, 0.5),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    });

    artemisLabelRef.current.add({
      position: pos,
      text: `ORION — ${Math.round(artemisDistanceKm).toLocaleString()} km`,
      font: "bold 11px sans-serif",
      fillColor: Color.fromCssColorString("#FF8C00"),
      outlineColor: Color.BLACK,
      outlineWidth: 3,
      style: 2,
      horizontalOrigin: HorizontalOrigin.LEFT,
      verticalOrigin: VerticalOrigin.CENTER,
      pixelOffset: { x: 16, y: 0 } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      show: true,
      scaleByDistance: new NearFarScalar(1e5, 1.0, 1e7, 0.4),
    });
  }, [artemisDistanceKm]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
    />
  );
}
