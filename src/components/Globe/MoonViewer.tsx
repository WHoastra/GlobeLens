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
  HorizontalOrigin,
  VerticalOrigin,
  NearFarScalar,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).CESIUM_BASE_URL = "/cesium";
}

const MOON_RADIUS = 1_737_400; // meters

const LUNAR_FEATURES = [
  { name: "Apollo 11 Landing Site", lat: 0.6744, lon: 23.473 },
  { name: "Apollo 17 Landing Site", lat: 20.1908, lon: 30.7717 },
  { name: "Copernicus Crater", lat: 9.62, lon: -20.08 },
  { name: "Tycho Crater", lat: -43.31, lon: -11.36 },
  { name: "South Pole (Artemis III)", lat: -89.9, lon: 0 },
  { name: "Sea of Tranquility", lat: 8.5, lon: 31.4 },
  { name: "Ocean of Storms", lat: -18.4, lon: -57.4 },
  { name: "Sea of Serenity", lat: 28.0, lon: 17.5 },
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

    // Start with a nice view of the Moon
    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(20, 5, 5_000_000, MOON_ELLIPSOID),
    });

    // Add lunar feature labels
    const labels = viewer.scene.primitives.add(
      new LabelCollection()
    ) as LabelCollection;

    for (const f of LUNAR_FEATURES) {
      labels.add({
        position: Cartesian3.fromDegrees(f.lon, f.lat, 2000, MOON_ELLIPSOID),
        text: f.name,
        font: "bold 12px sans-serif",
        fillColor: Color.WHITE,
        outlineColor: Color.BLACK,
        outlineWidth: 3,
        style: 2,
        horizontalOrigin: HorizontalOrigin.CENTER,
        verticalOrigin: VerticalOrigin.BOTTOM,
        scaleByDistance: new NearFarScalar(1e4, 1.0, 3e6, 0.3),
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
