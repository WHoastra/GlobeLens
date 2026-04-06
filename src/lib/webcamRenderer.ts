import {
  Viewer,
  Cartesian3,
  Cartesian2,
  Color,
  BillboardCollection,
  LabelCollection,
  HorizontalOrigin,
  VerticalOrigin,
  NearFarScalar,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  defined,
  Cartographic,
  Math as CesiumMath,
} from "cesium";
import { Webcam } from "@/types";

/** Distance in degrees to match a click to a webcam pin */
const CLICK_TOLERANCE_DEG = 1.5;

/**
 * Renders webcam pins on the Cesium globe and handles click interactions.
 * Webcams appear as small cyan dots; clicking opens the webcam popup.
 */
export class WebcamRenderer {
  private viewer: Viewer;
  private pins: BillboardCollection | null = null;
  private labels: LabelCollection | null = null;
  private webcams: Webcam[] = [];
  private handler: ScreenSpaceEventHandler | null = null;
  private onWebcamClick: ((webcam: Webcam) => void) | null = null;
  private visible = false;

  constructor(viewer: Viewer) {
    this.viewer = viewer;
  }

  init() {
    if (this.viewer.isDestroyed()) return;

    // We use a canvas-drawn circle as a billboard image
    this.pins = this.viewer.scene.primitives.add(
      new BillboardCollection()
    ) as BillboardCollection;

    this.labels = this.viewer.scene.primitives.add(
      new LabelCollection()
    ) as LabelCollection;
  }

  setOnWebcamClick(cb: (webcam: Webcam) => void) {
    this.onWebcamClick = cb;
  }

  render(webcams: Webcam[]) {
    if (!this.pins || !this.labels || this.viewer.isDestroyed()) return;

    this.pins.removeAll();
    this.labels.removeAll();
    this.webcams = webcams;

    for (const cam of webcams) {
      // Pin dot
      this.pins.add({
        position: Cartesian3.fromDegrees(cam.longitude, cam.latitude, 1000),
        image: this.createPinCanvas(),
        width: 18,
        height: 18,
        horizontalOrigin: HorizontalOrigin.CENTER,
        verticalOrigin: VerticalOrigin.CENTER,
        scaleByDistance: new NearFarScalar(5e4, 1.2, 5e6, 0.4),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        show: true,
      });

      // Label (only visible when zoomed in close)
      this.labels.add({
        position: Cartesian3.fromDegrees(cam.longitude, cam.latitude, 1500),
        text: cam.title.length > 30 ? cam.title.substring(0, 28) + "..." : cam.title,
        font: "10px sans-serif",
        fillColor: Color.WHITE.withAlpha(0.9),
        outlineColor: Color.BLACK,
        outlineWidth: 2,
        style: 2, // FILL_AND_OUTLINE
        horizontalOrigin: HorizontalOrigin.LEFT,
        verticalOrigin: VerticalOrigin.CENTER,
        pixelOffset: new Cartesian2(14, 0),
        scaleByDistance: new NearFarScalar(1e4, 1.0, 1e6, 0.0),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        show: true,
      });
    }
  }

  /** Creates a small cyan circle with a white border as a pin icon */
  private createPinCanvas(): HTMLCanvasElement {
    const size = 24;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    // Outer ring
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 200, 255, 0.9)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Camera icon (simple rectangle + small triangle)
    ctx.fillStyle = "white";
    ctx.fillRect(7, 9, 8, 6);
    ctx.beginPath();
    ctx.moveTo(15, 10);
    ctx.lineTo(18, 8);
    ctx.lineTo(18, 16);
    ctx.lineTo(15, 14);
    ctx.closePath();
    ctx.fill();

    return canvas;
  }

  enableClickHandler() {
    if (this.handler || this.viewer.isDestroyed()) return;

    this.handler = new ScreenSpaceEventHandler(this.viewer.scene.canvas);
    this.handler.setInputAction((movement: { position: Cartesian2 }) => {
      if (!this.visible || this.webcams.length === 0) return;

      const pickedPos = this.viewer.camera.pickEllipsoid(
        movement.position,
        this.viewer.scene.globe.ellipsoid
      );
      if (!defined(pickedPos)) return;

      const carto = Cartographic.fromCartesian(pickedPos);
      const clickLat = CesiumMath.toDegrees(carto.latitude);
      const clickLon = CesiumMath.toDegrees(carto.longitude);

      // Scale tolerance based on camera altitude for better UX
      const altitude = this.viewer.camera.positionCartographic.height;
      const tolerance = Math.min(CLICK_TOLERANCE_DEG, Math.max(0.05, altitude / 1_000_000));

      let nearest: Webcam | null = null;
      let nearestDist = Infinity;

      for (const cam of this.webcams) {
        const dist = Math.sqrt(
          (cam.latitude - clickLat) ** 2 + (cam.longitude - clickLon) ** 2
        );
        if (dist < nearestDist && dist < tolerance) {
          nearest = cam;
          nearestDist = dist;
        }
      }

      if (nearest && this.onWebcamClick) {
        this.onWebcamClick(nearest);
      }
    }, ScreenSpaceEventType.LEFT_CLICK);
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    if (this.pins) this.pins.show = visible;
    if (this.labels) this.labels.show = visible;
  }

  /** Get camera center coordinates and altitude for fetching nearby webcams */
  getCameraView(): { latitude: number; longitude: number; altitude: number } | null {
    if (this.viewer.isDestroyed()) return null;
    const carto = this.viewer.camera.positionCartographic;
    return {
      latitude: CesiumMath.toDegrees(carto.latitude),
      longitude: CesiumMath.toDegrees(carto.longitude),
      altitude: carto.height,
    };
  }

  destroy() {
    if (this.handler) this.handler.destroy();
    if (this.pins && !this.viewer.isDestroyed()) {
      this.viewer.scene.primitives.remove(this.pins);
    }
    if (this.labels && !this.viewer.isDestroyed()) {
      this.viewer.scene.primitives.remove(this.labels);
    }
    this.pins = null;
    this.labels = null;
    this.handler = null;
    this.webcams = [];
  }
}
