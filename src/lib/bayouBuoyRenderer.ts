import {
  Viewer,
  Cartesian2,
  Cartesian3,
  Color,
  PointPrimitive,
  PointPrimitiveCollection,
  Math as CesiumMath,
} from "cesium";

// Numeric sensor fields that can be color-mapped on the globe.
export type SensorKey =
  | "airTempC" | "humidity" | "barometricMb" | "windSpeedKts" | "rainfallMmHr"
  | "waterTempC" | "pressureMbar" | "depthM" | "salinityPpt" | "conductivityMs"
  | "dissolvedOxygenMgL" | "turbidityNtu" | "pH" | "orpMv"
  | "oilFluorescencePpb" | "chlorophyllUgL" | "currentSpeedMs"
  | "waveHeightFt" | "wavePeriodS";

// Wide BuoyData — matches the full /api/bayou-buoys response shape so clicks
// can flow directly into BuoyDetailPanel without a separate lookup.
export interface BuoyData {
  id: string;
  parish: "Terrebonne" | "Lafourche";
  lat: number;
  lon: number;
  basin: string;
  deployedDate: string;
  distanceFromGulfKm: number;
  airTempC: number;
  humidity: number;
  barometricMb: number;
  windSpeedKts: number;
  windDirDeg: number;
  rainfallMmHr: number;
  waterTempC: number;
  pressureMbar: number;
  depthM: number;
  salinityPpt: number;
  conductivityMs: number;
  dissolvedOxygenMgL: number;
  turbidityNtu: number;
  pH: number;
  orpMv: number;
  oilFluorescencePpb: number;
  chlorophyllUgL: number;
  currentSpeedMs: number;
  currentDirDeg: number;
  waveHeightFt: number;
  wavePeriodS: number;
  batteryPct: number;
  signalDbm: number;
  solarChargeW: number;
  hurricaneMode: boolean;
  oilAlert: boolean;
  algalAlert: boolean;
  online: boolean;
}

export interface BuoyNetworkData {
  mode: string;
  timestamp: number;
  buoyCount: number;
  alerts: { oil: number; algal: number; hurricane: boolean; offline: number };
  buoys: BuoyData[];
}

const COLOR_OIL = Color.fromCssColorString("#FF3300");
const COLOR_ALGAL = Color.fromCssColorString("#00FF88");
const COLOR_HURRICANE = Color.fromCssColorString("#FFAA00");
const COLOR_OFFLINE = Color.fromCssColorString("#666666");
const COLOR_FRESH = Color.fromCssColorString("#88BBFF");
const COLOR_OCEAN = Color.fromCssColorString("#0066CC");

const MOBILE_VISIBLE_CAP = 500;
const VIEWPORT_DEBOUNCE_MS = 200;

interface PointState {
  buoy: BuoyData;
  pulses: boolean;
  baseSize: number;
  pulseRange: number;
  staticSize: number;
}

function colorForBuoy(buoy: BuoyData): Color {
  if (!buoy.online) return COLOR_OFFLINE;
  if (buoy.oilAlert) return COLOR_OIL;
  if (buoy.algalAlert) return COLOR_ALGAL;
  if (buoy.hurricaneMode) return COLOR_HURRICANE;

  // Salinity gradient: <5 ppt = fresh, >25 ppt = ocean, linear interp
  const t = Math.max(0, Math.min(1, (buoy.salinityPpt - 5) / 20));
  return Color.lerp(COLOR_FRESH, COLOR_OCEAN, t, new Color());
}

// Sequential gradient: blue (low) → amber (mid) → red (high). Used when a
// specific sensor metric is selected for spatial visualization.
function metricGradientColor(t: number): Color {
  const c = Math.max(0, Math.min(1, t));
  let r: number, g: number, b: number;
  if (c < 0.5) {
    const f = c * 2;
    // Blue (37, 99, 235) → Amber (245, 158, 11)
    r = 37 + f * (245 - 37);
    g = 99 + f * (158 - 99);
    b = 235 + f * (11 - 235);
  } else {
    const f = (c - 0.5) * 2;
    // Amber → Red (220, 38, 38)
    r = 245 + f * (220 - 245);
    g = 158 + f * (38 - 158);
    b = 11 + f * (38 - 11);
  }
  return new Color(r / 255, g / 255, b / 255, 1);
}

function pointStateForBuoy(buoy: BuoyData): PointState {
  // Priority order matches color logic above
  if (!buoy.online) {
    return { buoy, pulses: false, baseSize: 5, pulseRange: 0, staticSize: 5 };
  }
  if (buoy.oilAlert) {
    return { buoy, pulses: true, baseSize: 8, pulseRange: 6, staticSize: 11 };
  }
  if (buoy.algalAlert) {
    return { buoy, pulses: false, baseSize: 10, pulseRange: 0, staticSize: 10 };
  }
  if (buoy.hurricaneMode) {
    return { buoy, pulses: true, baseSize: 7, pulseRange: 4, staticSize: 9 };
  }
  return { buoy, pulses: false, baseSize: 6, pulseRange: 0, staticSize: 6 };
}

export class BayouBuoyRenderer {
  private viewer: Viewer;
  private isMobile: boolean;
  private collection: PointPrimitiveCollection | null = null;
  private points: PointPrimitive[] = [];
  private pointStates: PointState[] = [];
  private buoyByPoint: Map<PointPrimitive, BuoyData> = new Map();
  private removePreRender: (() => void) | null = null;
  private removeMoveEnd: (() => void) | null = null;
  private cullDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private frame = 0;
  private metricMode: SensorKey | null = null;
  private metricRange: { min: number; max: number } | null = null;
  private pickScratch = new Cartesian2();

  constructor(viewer: Viewer, isMobile: boolean) {
    this.viewer = viewer;
    this.isMobile = isMobile;

    this.collection = viewer.scene.primitives.add(
      new PointPrimitiveCollection(),
    ) as PointPrimitiveCollection;

    // Pulsing animation tied to scene preRender
    this.removePreRender = viewer.scene.preRender.addEventListener(() => {
      if (viewer.isDestroyed()) return;
      this.frame++;
      // Sin wave at ~1.5 Hz assuming 60fps
      const phase = (Math.sin(this.frame * 0.05) + 1) / 2; // 0..1
      for (let i = 0; i < this.points.length; i++) {
        const state = this.pointStates[i];
        if (!state || !state.pulses) continue;
        this.points[i].pixelSize = state.baseSize + state.pulseRange * phase;
      }
    });

    // Mobile viewport culling on camera moveEnd
    if (this.isMobile) {
      this.removeMoveEnd = viewer.camera.moveEnd.addEventListener(() => {
        if (this.cullDebounceTimer) clearTimeout(this.cullDebounceTimer);
        this.cullDebounceTimer = setTimeout(() => this.applyViewportCull(), VIEWPORT_DEBOUNCE_MS);
      });
    }
  }

  render(data: BuoyNetworkData): void {
    if (!this.collection || this.viewer.isDestroyed()) return;

    const incoming = data.buoys;

    if (this.points.length === incoming.length) {
      // In-place update — preserve GPU buffer
      for (let i = 0; i < incoming.length; i++) {
        const buoy = incoming[i];
        const state = pointStateForBuoy(buoy);
        const pt = this.points[i];

        pt.position = Cartesian3.fromDegrees(buoy.lon, buoy.lat, 0);
        pt.color = colorForBuoy(buoy);
        pt.pixelSize = state.staticSize;
        // Reuse existing point ref but refresh map entry
        this.buoyByPoint.set(pt, buoy);
        this.pointStates[i] = state;
      }
    } else {
      // Rebuild
      this.collection.removeAll();
      this.points = [];
      this.pointStates = [];
      this.buoyByPoint.clear();

      for (const buoy of incoming) {
        const state = pointStateForBuoy(buoy);
        const pt = this.collection.add({
          position: Cartesian3.fromDegrees(buoy.lon, buoy.lat, 0),
          color: colorForBuoy(buoy),
          pixelSize: state.staticSize,
          outlineColor: Color.BLACK.withAlpha(0.4),
          outlineWidth: 1,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        }) as PointPrimitive;
        this.points.push(pt);
        this.pointStates.push(state);
        this.buoyByPoint.set(pt, buoy);
      }
    }

    if (this.isMobile) {
      this.applyViewportCull();
    } else {
      // Desktop: ensure all visible
      for (const pt of this.points) pt.show = true;
    }

    // Apply gradient on top of default colors if metric mode is active
    if (this.metricMode) this.recolorByMetric();
  }

  /**
   * Set or clear a metric to color buoys by. When set, every point recolors
   * to a blue→amber→red gradient based on its value vs the network min/max.
   * Pass null to revert to the default alert/salinity coloring.
   */
  setMetricColorMode(metric: SensorKey | null): void {
    this.metricMode = metric;
    if (metric === null) {
      this.metricRange = null;
      this.recolorDefault();
    } else {
      this.recolorByMetric();
    }
  }

  /** Returns the current metric mode + value range so callers can render a legend. */
  getMetricRange(): { metric: SensorKey; min: number; max: number } | null {
    if (!this.metricMode || !this.metricRange) return null;
    return { metric: this.metricMode, ...this.metricRange };
  }

  private recolorDefault(): void {
    for (let i = 0; i < this.points.length; i++) {
      const buoy = this.pointStates[i]?.buoy;
      if (!buoy) continue;
      this.points[i].color = colorForBuoy(buoy);
    }
  }

  private recolorByMetric(): void {
    if (!this.metricMode || this.points.length === 0) return;
    const metric = this.metricMode;
    const values = this.pointStates.map((s) => s.buoy[metric] as number);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || Math.max(0.01, Math.abs(max) * 0.05);
    this.metricRange = { min, max };
    for (let i = 0; i < this.points.length; i++) {
      const v = this.pointStates[i].buoy[metric] as number;
      const t = (v - min) / range;
      this.points[i].color = metricGradientColor(t);
    }
  }

  clear(): void {
    if (!this.collection || this.viewer.isDestroyed()) return;
    this.collection.removeAll();
    this.points = [];
    this.pointStates = [];
    this.buoyByPoint.clear();
  }

  getBuoyAtScreenPosition(screenX: number, screenY: number): BuoyData | null {
    if (!this.collection || this.viewer.isDestroyed()) return null;

    const scene = this.viewer.scene;

    // Check the cursor first, then a 3x3 grid around it for generous hit radius
    const offsets: Array<[number, number]> = [
      [0, 0],
      [10, 0], [-10, 0], [0, 10], [0, -10],
      [10, 10], [-10, 10], [10, -10], [-10, -10],
    ];

    const pos = this.pickScratch;
    for (const [dx, dy] of offsets) {
      pos.x = screenX + dx;
      pos.y = screenY + dy;
      const picked = scene.pick(pos);
      if (picked && picked.primitive) {
        const buoy = this.buoyByPoint.get(picked.primitive as PointPrimitive);
        if (buoy) return buoy;
      }
    }
    return null;
  }

  destroy(): void {
    if (this.cullDebounceTimer) {
      clearTimeout(this.cullDebounceTimer);
      this.cullDebounceTimer = null;
    }
    if (this.removePreRender) {
      this.removePreRender();
      this.removePreRender = null;
    }
    if (this.removeMoveEnd) {
      this.removeMoveEnd();
      this.removeMoveEnd = null;
    }
    if (this.collection && !this.viewer.isDestroyed()) {
      this.viewer.scene.primitives.remove(this.collection);
    }
    this.collection = null;
    this.points = [];
    this.pointStates = [];
    this.buoyByPoint.clear();
  }

  private applyViewportCull(): void {
    if (!this.collection || this.viewer.isDestroyed() || this.points.length === 0) return;

    const rect = this.viewer.camera.computeViewRectangle(
      this.viewer.scene.globe.ellipsoid,
    );
    if (!rect) {
      // Camera not pointing at the globe — hide everything
      for (const pt of this.points) pt.show = false;
      return;
    }

    const west = CesiumMath.toDegrees(rect.west);
    const east = CesiumMath.toDegrees(rect.east);
    const south = CesiumMath.toDegrees(rect.south);
    const north = CesiumMath.toDegrees(rect.north);
    const wraps = west > east; // crossed antimeridian

    // First pass: collect indices inside the viewport
    const visibleIndices: number[] = [];
    for (let i = 0; i < this.points.length; i++) {
      const buoy = this.pointStates[i].buoy;
      const inLat = buoy.lat >= south && buoy.lat <= north;
      const inLon = wraps
        ? buoy.lon >= west || buoy.lon <= east
        : buoy.lon >= west && buoy.lon <= east;
      if (inLat && inLon) visibleIndices.push(i);
    }

    // Cap at MOBILE_VISIBLE_CAP — if exceeded, take an even stride
    const allowed = new Set<number>();
    if (visibleIndices.length <= MOBILE_VISIBLE_CAP) {
      for (const idx of visibleIndices) allowed.add(idx);
    } else {
      const stride = visibleIndices.length / MOBILE_VISIBLE_CAP;
      for (let k = 0; k < MOBILE_VISIBLE_CAP; k++) {
        allowed.add(visibleIndices[Math.floor(k * stride)]);
      }
    }

    for (let i = 0; i < this.points.length; i++) {
      this.points[i].show = allowed.has(i);
    }
  }
}
