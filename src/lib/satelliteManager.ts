import {
  Viewer,
  Cartesian3,
  Cartesian2,
  Color,
  PointPrimitiveCollection,
  BillboardCollection,
  PolylineCollection,
  NearFarScalar,
  LabelCollection,
  HorizontalOrigin,
  VerticalOrigin,
  Cartographic,
  Math as CesiumMath,
  Material,
  Matrix4,
  Transforms,
  Entity,
} from "cesium";
import {
  SatelliteData,
  SatellitePosition,
  getSatellitePosition,
  getOrbitPath,
  isISS,
  fetchAllSatellites,
  SatelliteType,
} from "./satellites";
import {
  getOrionPosition,
  getEarthOrbitPoints,
  getLunarTransitPoints,
  getFlybyReturnPoints,
  getMilestonesForView,
  isMissionActive,
  isMissionComplete,
  formatMET,
  getMoonDistanceKm,
  getMoonPositionECEF,
  ARTEMIS_CREW,
  ARTEMIS_STREAM_URL,
} from "./artemis";
import type { ArtemisViewMode } from "@/types";

const TYPE_COLORS: Record<SatelliteType, Color> = {
  station: Color.WHITE,
  starlink: Color.fromCssColorString("#4dabf7"),
  gps: Color.fromCssColorString("#69db7c"),
  weather: Color.fromCssColorString("#ffd43b"),
};

const DEFAULT_MAX_VISIBLE_SATS = 800;

interface SatelliteManagerOptions {
  maxVisibleSats?: number;
}

/** Draw a spaceship icon on a canvas for use as a Cesium billboard */
function createSpaceshipIcon(
  color: string,
  glowColor: string,
  size: number = 48
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const cx = size / 2;
  const cy = size / 2;
  const s = size / 48; // scale factor

  // Outer glow
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 10 * s;

  // Main body (elongated diamond / shuttle shape)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 20 * s);       // nose (top)
  ctx.lineTo(cx + 6 * s, cy - 4 * s);
  ctx.lineTo(cx + 8 * s, cy + 6 * s);
  ctx.lineTo(cx + 14 * s, cy + 16 * s); // right wing tip
  ctx.lineTo(cx + 6 * s, cy + 12 * s);
  ctx.lineTo(cx + 3 * s, cy + 18 * s); // right tail fin
  ctx.lineTo(cx, cy + 14 * s);         // tail center
  ctx.lineTo(cx - 3 * s, cy + 18 * s); // left tail fin
  ctx.lineTo(cx - 6 * s, cy + 12 * s);
  ctx.lineTo(cx - 14 * s, cy + 16 * s); // left wing tip
  ctx.lineTo(cx - 8 * s, cy + 6 * s);
  ctx.lineTo(cx - 6 * s, cy - 4 * s);
  ctx.closePath();
  ctx.fill();

  // Cockpit window
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#FFFFFF";
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.ellipse(cx, cy - 8 * s, 2.5 * s, 4 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Engine glow at the tail
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = "#88DDFF";
  ctx.shadowColor = "#88DDFF";
  ctx.shadowBlur = 6 * s;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 15 * s, 3 * s, 2 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1.0;
  ctx.shadowBlur = 0;

  return canvas;
}

export interface ISSInfo {
  position: SatellitePosition;
  crewCount: number | null;
  crewNames: string[];
}

export interface ArtemisInfo {
  phase: string;
  distanceFromEarthKm: number;
  distanceFromMoonKm: number;
  moonDistanceKm: number;
  met: string;
  crew: { name: string; role: string }[];
  streamUrl: string;
  missionActive: boolean;
  missionComplete: boolean;
}

export class SatelliteManager {
  private viewer: Viewer;
  private satellites: SatelliteData[] = [];
  private issSat: SatelliteData | null = null;
  private points: PointPrimitiveCollection | null = null;
  private spaceshipBillboards: BillboardCollection | null = null;
  private issIcon: string | null = null;
  private artemisIcon: string | null = null;
  private issLabel: LabelCollection | null = null;
  private orbitLines: PolylineCollection | null = null;
  private artemisOrbitLines: PolylineCollection | null = null;
  private artemisMilestoneEntities: Entity[] = [];
  private issOrbitEntity: string | null = null;
  private updateInterval: ReturnType<typeof setInterval> | null = null;
  private isVisible = false;
  private issAlwaysVisible = true;
  private issPointIndex = -1;
  private issLabelIndex = -1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private issPointRef: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private artemisPointRef: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private issLabelRef: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private artemisLabelRef: any = null;
  private selectedSatId: number | null = null;
  private onISSClick: ((info: ISSInfo) => void) | null = null;
  private onSatClick: ((pos: SatellitePosition) => void) | null = null;
  private isTracking = false;
  private isTrackingArtemis = false;
  private maxVisibleSats: number;
  private visibleTypes: Set<string> = new Set(["station", "starlink", "gps", "weather"]);

  constructor(viewer: Viewer, options?: SatelliteManagerOptions) {
    this.viewer = viewer;
    this.maxVisibleSats = options?.maxVisibleSats ?? DEFAULT_MAX_VISIBLE_SATS;
  }

  async init() {
    this.satellites = await fetchAllSatellites();
    if (this.viewer.isDestroyed()) return;
    this.issSat = this.satellites.find(isISS) ?? null;

    // Create point collection for all satellites
    this.points = this.viewer.scene.primitives.add(
      new PointPrimitiveCollection()
    ) as PointPrimitiveCollection;

    // Billboard collection for ISS + Artemis spaceship icons
    this.spaceshipBillboards = this.viewer.scene.primitives.add(
      new BillboardCollection()
    ) as BillboardCollection;

    // Pre-render spaceship icons as data URIs
    this.issIcon = createSpaceshipIcon("#FFD700", "#FFD700", 48).toDataURL();
    this.artemisIcon = createSpaceshipIcon("#FF8C00", "#FF6B00", 56).toDataURL();

    // Label collection for ISS + selected satellite
    this.issLabel = this.viewer.scene.primitives.add(
      new LabelCollection()
    ) as LabelCollection;

    // Polyline collection for orbit paths
    this.orbitLines = this.viewer.scene.primitives.add(
      new PolylineCollection()
    ) as PolylineCollection;


    // Separate polyline collection for Artemis trajectory
    this.artemisOrbitLines = this.viewer.scene.primitives.add(
      new PolylineCollection()
    ) as PolylineCollection;

    // Add ISS orbit path (hidden by default)
    if (this.issSat) {
      this.drawISSOrbit();
    }
    this.orbitLines.show = false;

    // Artemis trajectory is drawn on demand via setArtemisView()
    this.artemisOrbitLines.show = false;

    this.update();
    this.startUpdating();
  }

  private drawISSOrbit() {
    if (!this.issSat || !this.orbitLines) return;

    const path = getOrbitPath(this.issSat, new Date(), 200, 92);
    if (path.length < 2) return;

    const positions = path.map((p) =>
      Cartesian3.fromDegrees(p.longitude, p.latitude, p.altitude * 1000)
    );

    this.orbitLines.add({
      positions,
      width: 1.5,
      material: Material.fromType("Color", {
        color: Color.fromCssColorString("rgba(255, 215, 0, 0.4)"),
      }),
      show: true,
    });
  }


  private update() {
    if (!this.points || !this.issLabel || !this.spaceshipBillboards) return;

    const now = new Date();
    const viewer = this.viewer;
    if (viewer.isDestroyed()) return;

    // Get camera info for viewport culling
    const cameraPos = viewer.camera.positionCartographic;
    const cameraHeight = cameraPos.height;
    const cameraLat = CesiumMath.toDegrees(cameraPos.latitude);

    // Fade factor based on altitude
    const fadeMin = 500_000;
    const fadeMax = 3_000_000;
    const fadeFactor = Math.max(0, Math.min(1, (cameraHeight - fadeMin) / (fadeMax - fadeMin)));

    // Clear existing points and billboards
    this.points.removeAll();
    this.spaceshipBillboards?.removeAll();
    this.issLabel.removeAll();
    this.issPointIndex = -1;
    this.issLabelIndex = -1;
    this.issPointRef = null;
    this.artemisPointRef = null;
    this.issLabelRef = null;
    this.artemisLabelRef = null;

    // Hide ISS/Artemis when zoomed in close to surface (below 500km altitude)
    const showSpacecraft = cameraHeight > 500_000;

    // Calculate ISS position
    let issPos: SatellitePosition | null = null;
    if (this.issSat && showSpacecraft) {
      issPos = getSatellitePosition(this.issSat, now);
      if (issPos) {
        const cartesian = Cartesian3.fromDegrees(
          issPos.longitude,
          issPos.latitude,
          issPos.altitude * 1000
        );

        // ISS spaceship billboard with pulsing scale, rotated to heading
        const issPulse = 0.8 + Math.sin(Date.now() / 300) * 0.15;

        this.issPointRef = this.spaceshipBillboards!.add({
          position: cartesian,
          image: this.issIcon!,
          scale: issPulse,
          rotation: -issPos.heading, // Cesium rotation is CCW, heading is CW
          alignedAxis: Cartesian3.ZERO, // align to screen
          show: true,
          scaleByDistance: new NearFarScalar(1e6, 1.2, 3e7, 0.6),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        });
        this.issPointIndex = 0;

        // ISS label — always visible
        this.issLabelRef = this.issLabel.add({
          position: cartesian,
          text: "ISS",
          font: "bold 13px sans-serif",
          fillColor: Color.fromCssColorString("#FFD700"),
          outlineColor: Color.BLACK,
          outlineWidth: 3,
          style: 2, // FILL_AND_OUTLINE
          horizontalOrigin: HorizontalOrigin.LEFT,
          verticalOrigin: VerticalOrigin.CENTER,
          pixelOffset: { x: 14, y: 0 } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
          show: true,
          scaleByDistance: new NearFarScalar(1e6, 1.0, 3e7, 0.5),
        });
        this.issLabelIndex = 0;

        // Track ISS if tracking mode is on
        if (this.isTracking) {
          viewer.camera.lookAt(
            cartesian,
            new Cartesian3(0, 0, issPos.altitude * 1000 + 2_000_000)
          );
        }
      }
    }

    // Render Artemis II / Orion
    const orion = showSpacecraft ? getOrionPosition(now) : null;
    if (orion) {
      const artemisPulse = 1.0 + Math.sin(Date.now() / 250) * 0.2;

      // Compute Artemis heading from position delta
      let artemisRotation = 0;
      const futureOrion = getOrionPosition(new Date(now.getTime() + 60_000));
      if (futureOrion) {
        const curCart = Cartographic.fromCartesian(orion.position);
        const futCart = Cartographic.fromCartesian(futureOrion.position);
        const dLon = CesiumMath.toDegrees(futCart.longitude) - CesiumMath.toDegrees(curCart.longitude);
        const dLat = CesiumMath.toDegrees(futCart.latitude) - CesiumMath.toDegrees(curCart.latitude);
        artemisRotation = -Math.atan2(dLon, dLat);
      }

      this.artemisPointRef = this.spaceshipBillboards!.add({
        position: orion.position,
        image: this.artemisIcon!,
        scale: artemisPulse,
        rotation: artemisRotation,
        alignedAxis: Cartesian3.ZERO,
        show: true,
        scaleByDistance: new NearFarScalar(1e7, 1.5, 5e8, 0.8),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      });

      this.artemisLabelRef = this.issLabel.add({
        position: orion.position,
        text: "ARTEMIS II — ORION",
        font: "bold 12px sans-serif",
        fillColor: Color.fromCssColorString("#FF8C00"),
        outlineColor: Color.BLACK,
        outlineWidth: 3,
        style: 2,
        horizontalOrigin: HorizontalOrigin.LEFT,
        verticalOrigin: VerticalOrigin.CENTER,
        pixelOffset: { x: 18, y: 0 } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        show: true,
        scaleByDistance: new NearFarScalar(1e7, 1.0, 5e8, 0.5),
      });

      // Track Artemis if tracking mode is on
      if (this.isTrackingArtemis) {
        viewer.camera.lookAt(
          orion.position,
          new Cartesian3(0, 0, Math.max(orion.distanceFromEarthKm * 500, 5_000_000))
        );
      }
    }

    // Only render other satellites if layer is visible and zoomed out enough
    if (this.isVisible && fadeFactor > 0) {
      // Score satellites by rough distance to camera, pick nearest MAX_VISIBLE_SATS
      const scored: { sat: SatelliteData; dist: number }[] = [];
      for (const sat of this.satellites) {
        if (isISS(sat)) continue; // already rendered
        const dlat = Math.abs(cameraLat - (sat.satrec as unknown as Record<string, number>).inclo * 57.3);
        scored.push({ sat, dist: dlat });
      }
      scored.sort((a, b) => a.dist - b.dist);
      const visible = scored.slice(0, this.maxVisibleSats);

      for (const { sat } of visible) {
        if (!this.visibleTypes.has(sat.type)) continue;
        const pos = getSatellitePosition(sat, now);
        if (!pos) continue;

        const cartesian = Cartesian3.fromDegrees(
          pos.longitude,
          pos.latitude,
          pos.altitude * 1000
        );

        const color = TYPE_COLORS[sat.type] ?? Color.WHITE;

        this.points.add({
          position: cartesian,
          pixelSize: sat.type === "station" ? 8 : 5,
          color: color.withAlpha(fadeFactor),
          outlineColor: Color.WHITE.withAlpha(fadeFactor * 0.5),
          outlineWidth: 1,
          show: true,
          scaleByDistance: new NearFarScalar(1e6, 1.2, 3e7, 0.5),
        });
      }
    }
  }

  private startUpdating() {
    this.updateInterval = setInterval(() => {
      if (this.viewer.isDestroyed()) {
        this.destroy();
        return;
      }
      this.update();

      // Refresh ISS orbit line every 5 minutes
    }, 2000);
  }

  setVisible(visible: boolean) {
    this.isVisible = visible;
    this.update();
  }

  setVisibleTypes(types: Set<string>) {
    this.visibleTypes = types;
  }

  setISSOrbitVisible(visible: boolean) {
    if (this.orbitLines) {
      this.orbitLines.show = visible;
    }
  }

  private artemisView: ArtemisViewMode = "none";

  setArtemisView(view: ArtemisViewMode) {
    this.artemisView = view;
    this.redrawArtemisForView(view);
    if (view !== "none") {
      this.flyToArtemisView(view);
    }
  }

  private redrawArtemisForView(view: ArtemisViewMode) {
    // Clear existing polylines and milestones
    if (this.artemisOrbitLines) {
      this.artemisOrbitLines.removeAll();
    }
    this.clearMilestones();

    if (view === "none") {
      if (this.artemisOrbitLines) this.artemisOrbitLines.show = false;
      return;
    }

    const now = new Date();
    let points: Cartesian3[];

    switch (view) {
      case "earth-orbit":
        points = getEarthOrbitPoints(now);
        break;
      case "lunar-transit":
        points = getLunarTransitPoints(now);
        break;
      case "flyby-return":
        points = getFlybyReturnPoints(now);
        break;
      default:
        return;
    }

    if (points.length < 2 || !this.artemisOrbitLines) return;

    // Glowing trajectory line
    this.artemisOrbitLines.add({
      positions: points,
      width: 4.0,
      material: Material.fromType("PolylineGlow", {
        glowPower: 0.25,
        color: Color.fromCssColorString("#FF6B00"),
      }),
      show: true,
    });
    this.artemisOrbitLines.show = true;

    // Milestone markers for this view
    const milestones = getMilestonesForView(view, now);
    for (const { milestone, position } of milestones) {
      const markerEntity = this.viewer.entities.add({
        position,
        point: {
          pixelSize: 8,
          color: Color.fromCssColorString("#FFAA00"),
          outlineColor: Color.WHITE,
          outlineWidth: 2,
          scaleByDistance: new NearFarScalar(1e7, 1.5, 5e8, 0.6),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: milestone.shortLabel,
          font: "bold 11px sans-serif",
          fillColor: Color.WHITE,
          outlineColor: Color.BLACK,
          outlineWidth: 3,
          style: 2, // FILL_AND_OUTLINE
          horizontalOrigin: HorizontalOrigin.LEFT,
          verticalOrigin: VerticalOrigin.CENTER,
          pixelOffset: new Cartesian2(12, 0),
          scaleByDistance: new NearFarScalar(1e7, 1.0, 5e8, 0.4),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          backgroundColor: Color.fromCssColorString("rgba(0,0,0,0.6)"),
          showBackground: true,
          backgroundPadding: new Cartesian2(5, 3),
        },
        show: true,
      });
      this.artemisMilestoneEntities.push(markerEntity);
    }
  }

  private flyToArtemisView(view: ArtemisViewMode) {
    const moonPos = getMoonPositionECEF(new Date());
    const moonDist = Cartesian3.magnitude(moonPos);
    const moonDir = Cartesian3.normalize(moonPos, new Cartesian3());
    const up = new Cartesian3(0, 0, 1);
    const sideDir = Cartesian3.cross(moonDir, up, new Cartesian3());
    Cartesian3.normalize(sideDir, sideDir);

    if (view === "earth-orbit") {
      // Zoom near Earth to see the high elliptical orbit
      const offset = Cartesian3.multiplyByScalar(sideDir, 200_000_000, new Cartesian3());
      this.viewer.camera.flyTo({
        destination: offset,
        orientation: {
          direction: Cartesian3.normalize(
            Cartesian3.negate(offset, new Cartesian3()),
            new Cartesian3()
          ),
          up: new Cartesian3(0, 0, 1),
        },
        duration: 2.5,
      });
    } else if (view === "lunar-transit") {
      // View from side showing Earth-Moon transit arc
      const midpoint = Cartesian3.multiplyByScalar(moonDir, moonDist * 0.45, new Cartesian3());
      const offset = Cartesian3.multiplyByScalar(sideDir, moonDist * 0.8, new Cartesian3());
      const cameraPos = Cartesian3.add(midpoint, offset, new Cartesian3());
      this.viewer.camera.flyTo({
        destination: cameraPos,
        orientation: {
          direction: Cartesian3.normalize(
            Cartesian3.subtract(midpoint, cameraPos, new Cartesian3()),
            new Cartesian3()
          ),
          up: new Cartesian3(0, 0, 1),
        },
        duration: 3,
      });
    } else if (view === "flyby-return") {
      // View biased toward Moon side to show the loop and return
      const midpoint = Cartesian3.multiplyByScalar(moonDir, moonDist * 0.6, new Cartesian3());
      const offset = Cartesian3.multiplyByScalar(sideDir, moonDist * 0.9, new Cartesian3());
      const cameraPos = Cartesian3.add(midpoint, offset, new Cartesian3());
      this.viewer.camera.flyTo({
        destination: cameraPos,
        orientation: {
          direction: Cartesian3.normalize(
            Cartesian3.subtract(midpoint, cameraPos, new Cartesian3()),
            new Cartesian3()
          ),
          up: new Cartesian3(0, 0, 1),
        },
        duration: 3,
      });
    }
  }

  private clearMilestones() {
    for (const entity of this.artemisMilestoneEntities) {
      this.viewer.entities.remove(entity);
    }
    this.artemisMilestoneEntities = [];
  }

  /** Check if a picked primitive is ISS or Artemis. Returns entity type or null. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  identifyPrimitive(picked: any): "iss" | "artemis" | null {
    if (!picked) return null;
    // scene.pick() returns { primitive: collection, id: individualPrimitive }
    const id = picked.id;
    const prim = picked.primitive;
    // Check point primitives
    if (id === this.issPointRef || prim === this.issPointRef) return "iss";
    if (id === this.artemisPointRef || prim === this.artemisPointRef) return "artemis";
    // Check label primitives (larger click target)
    if (id === this.issLabelRef || prim === this.issLabelRef) return "iss";
    if (id === this.artemisLabelRef || prim === this.artemisLabelRef) return "artemis";
    return null;
  }

  setOnISSClick(cb: (info: ISSInfo) => void) {
    this.onISSClick = cb;
  }

  setOnSatClick(cb: (pos: SatellitePosition) => void) {
    this.onSatClick = cb;
  }

  /** Fly camera to track the ISS */
  startTrackingISS() {
    this.isTracking = true;
    if (this.issSat) {
      const pos = getSatellitePosition(this.issSat, new Date());
      if (pos) {
        this.viewer.camera.flyTo({
          destination: Cartesian3.fromDegrees(
            pos.longitude,
            pos.latitude,
            pos.altitude * 1000 + 2_000_000
          ),
          duration: 2,
        });
      }
    }
  }

  stopTrackingISS() {
    this.isTracking = false;
    this.viewer.camera.lookAtTransform(Matrix4.IDENTITY);
  }

  /** Get current ISS info for the panel */
  async getISSInfo(): Promise<ISSInfo | null> {
    if (!this.issSat) return null;
    const pos = getSatellitePosition(this.issSat, new Date());
    if (!pos) return null;

    let crewCount: number | null = null;
    let crewNames: string[] = [];
    try {
      const res = await fetch("/api/iss-crew");
      const data = await res.json();
      crewCount = data.number ?? null;
      crewNames = data.people
        ?.filter((p: { craft: string }) => p.craft === "ISS")
        .map((p: { name: string }) => p.name) ?? [];
    } catch {
      // non-critical
    }

    return { position: pos, crewCount, crewNames };
  }

  get isTrackingISS() {
    return this.isTracking;
  }

  /** Fly camera out to show full Earth–Moon trajectory */
  startTrackingArtemis() {
    this.isTrackingArtemis = true;
    this.isTracking = false; // stop ISS tracking if active

    // Position camera to see both Earth and Moon with the trajectory between them
    const moonPos = getMoonPositionECEF(new Date());
    const moonDist = Cartesian3.magnitude(moonPos);

    // Camera at midpoint between Earth and Moon, offset perpendicular to see the arc
    const moonDir = Cartesian3.normalize(moonPos, new Cartesian3());
    const up = new Cartesian3(0, 0, 1);
    const sideDir = Cartesian3.cross(moonDir, up, new Cartesian3());
    Cartesian3.normalize(sideDir, sideDir);

    // Position: midway along Earth-Moon line, offset "above" the plane
    const midpoint = Cartesian3.multiplyByScalar(moonDir, moonDist * 0.45, new Cartesian3());
    const offset = Cartesian3.multiplyByScalar(sideDir, moonDist * 0.8, new Cartesian3());
    const cameraPos = Cartesian3.add(midpoint, offset, new Cartesian3());

    this.viewer.camera.flyTo({
      destination: cameraPos,
      orientation: {
        direction: Cartesian3.normalize(
          Cartesian3.subtract(midpoint, cameraPos, new Cartesian3()),
          new Cartesian3()
        ),
        up: new Cartesian3(0, 0, 1),
      },
      duration: 3,
    });
  }

  stopTrackingArtemis() {
    this.isTrackingArtemis = false;
    this.viewer.camera.lookAtTransform(Matrix4.IDENTITY);
  }

  /** Fly camera back to Earth's default view */
  flyToEarth() {
    this.isTrackingArtemis = false;
    this.isTracking = false;
    this.viewer.camera.lookAtTransform(Matrix4.IDENTITY);

    const now = new Date();
    const hourAngle = ((now.getUTCHours() + now.getUTCMinutes() / 60) / 24) * 360 - 180;
    const terminatorLon = hourAngle - 90;

    this.viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(terminatorLon, 15, 22_000_000),
      duration: 2.5,
    });
  }

  /** Fly camera to the Moon — see near side, Moon as orbit/rotation center */
  flyToMoon() {
    this.isTrackingArtemis = false;
    this.isTracking = false;
    this.viewer.camera.lookAtTransform(Matrix4.IDENTITY);

    const moonPos = getMoonPositionECEF(new Date());

    // Position camera between Earth and Moon (Earth side) to see the near/front side
    const moonDir = Cartesian3.normalize(moonPos, new Cartesian3());
    const offsetDist = 10_000_000; // 10,000 km from Moon center, toward Earth
    const cameraPos = Cartesian3.subtract(
      moonPos,
      Cartesian3.multiplyByScalar(moonDir, offsetDist, new Cartesian3()),
      new Cartesian3()
    );

    // Use Transforms to create a reference frame centered on the Moon
    // so orbit controls rotate around the Moon
    const moonTransform = Transforms.eastNorthUpToFixedFrame(moonPos);

    this.viewer.camera.flyTo({
      destination: cameraPos,
      orientation: {
        direction: Cartesian3.normalize(
          Cartesian3.subtract(moonPos, cameraPos, new Cartesian3()),
          new Cartesian3()
        ),
        up: new Cartesian3(0, 0, 1),
      },
      duration: 2.5,
      complete: () => {
        // Lock orbit center on the Moon after fly completes
        if (!this.viewer.isDestroyed()) {
          this.viewer.camera.lookAtTransform(
            moonTransform,
            new Cartesian3(0, -offsetDist, offsetDist * 0.3)
          );
        }
      },
    });
  }

  /** Get camera distance from Earth center in km */
  getCameraDistanceKm(): number {
    if (this.viewer.isDestroyed()) return 0;
    return Cartesian3.magnitude(this.viewer.camera.position) / 1000;
  }

  /** Get current Artemis II info for the panel */
  getArtemisInfo(): ArtemisInfo | null {
    const orion = getOrionPosition(new Date());
    if (!orion) return null;

    return {
      phase: orion.phase,
      distanceFromEarthKm: orion.distanceFromEarthKm,
      distanceFromMoonKm: orion.distanceFromMoonKm,
      moonDistanceKm: getMoonDistanceKm(),
      met: formatMET(),
      crew: ARTEMIS_CREW,
      streamUrl: ARTEMIS_STREAM_URL,
      missionActive: isMissionActive(),
      missionComplete: isMissionComplete(),
    };
  }

  destroy() {
    if (this.updateInterval) clearInterval(this.updateInterval);
    this.clearMilestones();
    if (this.points && !this.viewer.isDestroyed()) {
      this.viewer.scene.primitives.remove(this.points);
    }
    if (this.spaceshipBillboards && !this.viewer.isDestroyed()) {
      this.viewer.scene.primitives.remove(this.spaceshipBillboards);
    }
    if (this.issLabel && !this.viewer.isDestroyed()) {
      this.viewer.scene.primitives.remove(this.issLabel);
    }
    if (this.orbitLines && !this.viewer.isDestroyed()) {
      this.viewer.scene.primitives.remove(this.orbitLines);
    }
    if (this.artemisOrbitLines && !this.viewer.isDestroyed()) {
      this.viewer.scene.primitives.remove(this.artemisOrbitLines);
    }
    this.points = null;
    this.spaceshipBillboards = null;
    this.issIcon = null;
    this.artemisIcon = null;

    this.issLabel = null;
    this.orbitLines = null;
    this.artemisOrbitLines = null;
    this.satellites = [];
    this.issSat = null;
  }
}
