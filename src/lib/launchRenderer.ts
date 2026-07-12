import {
  Viewer,
  Cartesian3,
  Cartesian2,
  Color,
  BillboardCollection,
  LabelCollection,
  PolylineCollection,
  HorizontalOrigin,
  VerticalOrigin,
  NearFarScalar,
  Material,
  Entity,
  CallbackProperty,
} from "cesium";
import type { Launch } from "@/types";
import { LAUNCH_PROVIDERS } from "@/types";

/** Distance in degrees to match a click to a launch pad pin */
const CLICK_TOLERANCE_DEG = 1.5;

/** Representative orbit altitudes (km) for drawing the target-orbit ring */
const ORBIT_ALTITUDES_KM: Record<string, number> = {
  LEO: 500,
  ISS: 420,
  SSO: 700,
  PO: 600,
  MEO: 20200,
  GTO: 35786, // apogee of the transfer orbit
  GEO: 35786,
  GSO: 35786,
  HEO: 1000,
};

/** Inclinations (deg) implied by common target orbits */
const ORBIT_INCLINATIONS: Record<string, number> = {
  SSO: 97.6,
  PO: 90,
  ISS: 51.6,
  GEO: 0,
  GSO: 0,
};

interface PadGroup {
  lat: number;
  lon: number;
  padName: string;
  location: string;
  launches: Launch[];
}

/**
 * Renders launch pads on the globe (one pin per pad, grouped) and, for a
 * selected launch, an illustrative ascent arc + target-orbit ring.
 */
export class LaunchRenderer {
  private viewer: Viewer;
  private pins: BillboardCollection | null = null;
  private labels: LabelCollection | null = null;
  private orbitLines: PolylineCollection | null = null;
  private padRingEntity: Entity | null = null;
  private pads: PadGroup[] = [];
  private pinIcons: Map<string, string> = new Map();
  private onLaunchClick: ((launch: Launch) => void) | null = null;
  private visible = false;

  constructor(viewer: Viewer) {
    this.viewer = viewer;
  }

  init() {
    if (this.viewer.isDestroyed()) return;
    this.pins = this.viewer.scene.primitives.add(new BillboardCollection()) as BillboardCollection;
    this.labels = this.viewer.scene.primitives.add(new LabelCollection()) as LabelCollection;
    this.orbitLines = this.viewer.scene.primitives.add(new PolylineCollection()) as PolylineCollection;
  }

  setOnLaunchClick(cb: (launch: Launch) => void) {
    this.onLaunchClick = cb;
  }

  render(launches: Launch[]) {
    if (!this.pins || !this.labels || this.viewer.isDestroyed()) return;

    this.pins.removeAll();
    this.labels.removeAll();

    // Group launches by pad so overlapping pins collapse into one marker
    const byPad = new Map<string, PadGroup>();
    for (const l of launches) {
      const key = `${l.latitude.toFixed(2)},${l.longitude.toFixed(2)}`;
      let group = byPad.get(key);
      if (!group) {
        group = { lat: l.latitude, lon: l.longitude, padName: l.padName, location: l.padLocation, launches: [] };
        byPad.set(key, group);
      }
      group.launches.push(l);
    }
    this.pads = Array.from(byPad.values());

    const now = Date.now();
    for (const pad of this.pads) {
      const next = this.primaryLaunch(pad, now);
      const color = LAUNCH_PROVIDERS.find((p) => p.key === next.provider)?.color ?? "#c084fc";

      this.pins.add({
        position: Cartesian3.fromDegrees(pad.lon, pad.lat, 2000),
        image: this.getPinIcon(color),
        width: 30,
        height: 30,
        horizontalOrigin: HorizontalOrigin.CENTER,
        verticalOrigin: VerticalOrigin.BOTTOM,
        scaleByDistance: new NearFarScalar(1e5, 1.3, 2e7, 0.6),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        show: true,
      });

      const upcomingCount = pad.launches.filter((l) => l.upcoming).length;
      const extra = upcomingCount > 1 ? ` (+${upcomingCount - 1})` : "";
      const text = next.rocketName.length > 26 ? next.rocketName.slice(0, 24) + "…" : next.rocketName;
      this.labels.add({
        position: Cartesian3.fromDegrees(pad.lon, pad.lat, 2500),
        text: text + extra,
        font: "bold 11px sans-serif",
        fillColor: Color.fromCssColorString(color),
        outlineColor: Color.BLACK,
        outlineWidth: 3,
        style: 2, // FILL_AND_OUTLINE
        horizontalOrigin: HorizontalOrigin.LEFT,
        verticalOrigin: VerticalOrigin.CENTER,
        pixelOffset: new Cartesian2(14, -14),
        scaleByDistance: new NearFarScalar(1e5, 1.0, 2e7, 0.45),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        show: true,
      });
    }

    if (this.pins) this.pins.show = this.visible;
    if (this.labels) this.labels.show = this.visible;
  }

  /** Soonest upcoming launch at a pad, falling back to the most recent past one */
  private primaryLaunch(pad: PadGroup, now: number): Launch {
    const upcoming = pad.launches
      .filter((l) => l.upcoming && new Date(l.net).getTime() >= now - 3_600_000)
      .sort((a, b) => new Date(a.net).getTime() - new Date(b.net).getTime());
    if (upcoming.length > 0) return upcoming[0];
    return [...pad.launches].sort((a, b) => new Date(b.net).getTime() - new Date(a.net).getTime())[0];
  }

  /** Rocket-shaped pin icon, cached per provider color */
  private getPinIcon(color: string): string {
    let icon = this.pinIcons.get(color);
    if (icon) return icon;

    const size = 40;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const cx = size / 2;

    ctx.shadowColor = color;
    ctx.shadowBlur = 8;

    // Rocket body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, 4); // nose
    ctx.quadraticCurveTo(cx + 7, 12, cx + 7, 22);
    ctx.lineTo(cx + 7, 28);
    ctx.lineTo(cx - 7, 28);
    ctx.lineTo(cx - 7, 22);
    ctx.quadraticCurveTo(cx - 7, 12, cx, 4);
    ctx.closePath();
    ctx.fill();

    // Fins
    ctx.beginPath();
    ctx.moveTo(cx - 7, 22);
    ctx.lineTo(cx - 13, 32);
    ctx.lineTo(cx - 7, 28);
    ctx.moveTo(cx + 7, 22);
    ctx.lineTo(cx + 13, 32);
    ctx.lineTo(cx + 7, 28);
    ctx.fill();

    // Flame
    ctx.shadowBlur = 6;
    ctx.shadowColor = "#FFAA00";
    ctx.fillStyle = "#FFAA00";
    ctx.beginPath();
    ctx.moveTo(cx - 4, 29);
    ctx.lineTo(cx, 38);
    ctx.lineTo(cx + 4, 29);
    ctx.closePath();
    ctx.fill();

    // Window
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(cx, 14, 3, 0, Math.PI * 2);
    ctx.fill();

    icon = canvas.toDataURL();
    this.pinIcons.set(color, icon);
    return icon;
  }

  /** Try to handle a click at the given lat/lon. Returns true if a pad was hit. */
  tryClick(clickLat: number, clickLon: number): boolean {
    if (!this.visible || this.pads.length === 0) return false;

    const altitude = this.viewer.camera.positionCartographic.height;
    const tolerance = Math.min(CLICK_TOLERANCE_DEG, Math.max(0.05, altitude / 1_000_000));

    let nearest: PadGroup | null = null;
    let nearestDist = Infinity;
    for (const pad of this.pads) {
      const dist = Math.sqrt((pad.lat - clickLat) ** 2 + (pad.lon - clickLon) ** 2);
      if (dist < nearestDist && dist < tolerance) {
        nearest = pad;
        nearestDist = dist;
      }
    }

    if (nearest && this.onLaunchClick) {
      this.onLaunchClick(this.primaryLaunch(nearest, Date.now()));
      return true;
    }
    return false;
  }

  /**
   * Draw an illustrative ascent arc + target-orbit ring for the launch,
   * plus a pulsing ring on its pad. Pass null to clear.
   */
  showOrbit(launch: Launch | null) {
    if (!this.orbitLines || this.viewer.isDestroyed()) return;
    this.orbitLines.removeAll();
    if (this.padRingEntity) {
      this.viewer.entities.remove(this.padRingEntity);
      this.padRingEntity = null;
    }
    if (!launch) return;

    const color = LAUNCH_PROVIDERS.find((p) => p.key === launch.provider)?.color ?? "#c084fc";
    const abbrev = (launch.orbitAbbrev ?? "LEO").toUpperCase();
    const altKm = ORBIT_ALTITUDES_KM[abbrev] ?? 500;
    // Minimum achievable inclination from a pad is its latitude (due-east launch)
    const incDeg = Math.max(
      ORBIT_INCLINATIONS[abbrev] ?? Math.abs(launch.latitude),
      Math.abs(launch.latitude) + 0.5
    );

    const { ring, ascent } = this.computeOrbitGeometry(launch.latitude, launch.longitude, incDeg, altKm);

    this.orbitLines.add({
      positions: ring,
      width: 2,
      material: Material.fromType("Color", {
        color: Color.fromCssColorString(color).withAlpha(0.45),
      }),
      show: true,
    });
    this.orbitLines.add({
      positions: ascent,
      width: 3.5,
      material: Material.fromType("PolylineGlow", {
        glowPower: 0.3,
        color: Color.fromCssColorString(color),
      }),
      show: true,
    });
    this.orbitLines.show = this.visible;

    this.padRingEntity = this.viewer.entities.add({
      position: Cartesian3.fromDegrees(launch.longitude, launch.latitude, 0),
      ellipse: {
        semiMinorAxis: new CallbackProperty(() => 15000 + Math.sin(Date.now() / 350) * 6000, false),
        semiMajorAxis: new CallbackProperty(() => 15000 + Math.sin(Date.now() / 350) * 6000, false),
        material: Color.fromCssColorString(color).withAlpha(0.12),
        outline: true,
        outlineColor: Color.fromCssColorString(color).withAlpha(0.9),
        outlineWidth: 2,
        height: 0,
      },
    });
  }

  /**
   * Great-circle at the target inclination passing over the pad (ring),
   * plus an eased ascent arc from the pad up to orbit altitude.
   * Illustrative — ignores Earth rotation and real launch azimuth.
   */
  private computeOrbitGeometry(padLat: number, padLon: number, incDeg: number, altKm: number) {
    const inc = (incDeg * Math.PI) / 180;
    const latR = (padLat * Math.PI) / 180;

    // Orbit angle at which the track crosses the pad latitude
    const sinT0 = Math.min(1, Math.max(-1, Math.sin(latR) / Math.sin(inc || 1e-6)));
    const t0 = Math.asin(sinT0);
    const lonAt = (t: number) => Math.atan2(Math.cos(inc) * Math.sin(t), Math.cos(t));
    const lonShift = padLon - (lonAt(t0) * 180) / Math.PI;

    const point = (t: number, altM: number) => {
      const lat = (Math.asin(Math.sin(inc) * Math.sin(t)) * 180) / Math.PI;
      const lon = lonShift + (lonAt(t) * 180) / Math.PI;
      return Cartesian3.fromDegrees(lon, lat, altM);
    };

    const ring: Cartesian3[] = [];
    for (let i = 0; i <= 240; i++) {
      ring.push(point((i / 240) * Math.PI * 2, altKm * 1000));
    }

    // Ascent: ~30° downrange along the orbit track, altitude eased 0 → altKm
    const ascent: Cartesian3[] = [];
    const span = Math.PI / 6;
    for (let i = 0; i <= 60; i++) {
      const f = i / 60;
      const eased = f * f * (3 - 2 * f); // smoothstep
      ascent.push(point(t0 + f * span, eased * altKm * 1000));
    }

    return { ring, ascent };
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    if (this.pins) this.pins.show = visible;
    if (this.labels) this.labels.show = visible;
    if (this.orbitLines) this.orbitLines.show = visible;
    if (this.padRingEntity) this.padRingEntity.show = visible;
  }

  destroy() {
    if (this.pins && !this.viewer.isDestroyed()) {
      this.viewer.scene.primitives.remove(this.pins);
    }
    if (this.labels && !this.viewer.isDestroyed()) {
      this.viewer.scene.primitives.remove(this.labels);
    }
    if (this.orbitLines && !this.viewer.isDestroyed()) {
      this.viewer.scene.primitives.remove(this.orbitLines);
    }
    if (this.padRingEntity && !this.viewer.isDestroyed()) {
      this.viewer.entities.remove(this.padRingEntity);
    }
    this.pins = null;
    this.labels = null;
    this.orbitLines = null;
    this.padRingEntity = null;
    this.pads = [];
  }
}
