import {
  Viewer,
  GeoJsonDataSource,
  Color,
  Entity,
  ColorMaterialProperty,
  ConstantProperty,
} from "cesium";

// Served by /api/geojson — stripped to 3 properties per feature to avoid Cesium's property limit
const GEOJSON_URL = "/api/geojson";

export class StatsRenderer {
  private viewer: Viewer;
  private dataSource: GeoJsonDataSource | null = null;
  private countryEntities = new Map<string, Entity>();
  private visible = false;
  private _initialized = false;
  private highlightedIso3: string | null = null;
  private onCountryClickCb: ((iso3: string) => void) | null = null;

  constructor(viewer: Viewer) {
    this.viewer = viewer;
  }

  isInitialized(): boolean {
    return this._initialized;
  }

  async init(): Promise<void> {
    if (this._initialized) return;

    try {
      this.dataSource = await GeoJsonDataSource.load(GEOJSON_URL, {
        stroke: Color.WHITE.withAlpha(0.2),
        fill: Color.TRANSPARENT,
        strokeWidth: 0.5,
      });

      this.viewer.dataSources.add(this.dataSource);
      this.dataSource.show = false;

      for (const entity of this.dataSource.entities.values) {
        const props = entity.properties;
        if (!props) continue;

        const iso3 =
          props.ISO_A3?.getValue(this.viewer.clock.currentTime) ??
          props.ADM0_A3?.getValue(this.viewer.clock.currentTime) ??
          props.iso_a3?.getValue(this.viewer.clock.currentTime);

        if (iso3 && iso3 !== "-99") {
          this.countryEntities.set(iso3, entity);
        }
      }

      this._initialized = true;
    } catch (e) {
      console.error("[StatsRenderer] Failed to load GeoJSON:", e);
    }
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (this.dataSource) {
      this.dataSource.show = visible;
    }
  }

  updateColors(data: Map<string, number>, colorScale: [string, string]): void {
    if (!this.dataSource) return;

    const values = Array.from(data.values());
    if (values.length === 0) return;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const lowColor = Color.fromCssColorString(colorScale[0]);
    const highColor = Color.fromCssColorString(colorScale[1]);
    const noDataColor = Color.GRAY.withAlpha(0.15);

    Array.from(this.countryEntities.entries()).forEach(([iso3, entity]) => {
      if (!entity.polygon) return;

      const value = data.get(iso3);
      let color: Color;

      if (value !== undefined) {
        const t = (value - min) / range;
        color = Color.lerp(lowColor, highColor, t, new Color());
        color.alpha = 0.7;
      } else {
        color = noDataColor;
      }

      entity.polygon.material = new ColorMaterialProperty(color);
      entity.polygon.outline = new ConstantProperty(true);
      entity.polygon.outlineColor = new ConstantProperty(Color.WHITE.withAlpha(0.15));
    });
  }

  highlightCountry(iso3: string | null): void {
    // Remove old highlight
    if (this.highlightedIso3) {
      const prev = this.countryEntities.get(this.highlightedIso3);
      if (prev?.polygon) {
        prev.polygon.outlineColor = new ConstantProperty(Color.WHITE.withAlpha(0.15));
        prev.polygon.outlineWidth = new ConstantProperty(1);
      }
    }

    this.highlightedIso3 = iso3;

    if (iso3) {
      const entity = this.countryEntities.get(iso3);
      if (entity?.polygon) {
        entity.polygon.outlineColor = new ConstantProperty(Color.WHITE.withAlpha(0.9));
        entity.polygon.outlineWidth = new ConstantProperty(3);
      }
    }
  }

  flyToCountry(iso3: string): void {
    const entity = this.countryEntities.get(iso3);
    if (!entity || this.viewer.isDestroyed()) return;
    this.viewer.flyTo(entity, { duration: 2 });
  }

  tryClick(pickedEntity: Entity): boolean {
    if (!this.visible || !pickedEntity) return false;

    const entries = Array.from(this.countryEntities.entries());
    for (let i = 0; i < entries.length; i++) {
      const [iso3, entity] = entries[i];
      if (pickedEntity === entity) {
        this.onCountryClickCb?.(iso3);
        return true;
      }
    }
    return false;
  }

  setOnCountryClick(cb: (iso3: string) => void): void {
    this.onCountryClickCb = cb;
  }

  destroy(): void {
    if (this.dataSource && !this.viewer.isDestroyed()) {
      this.viewer.dataSources.remove(this.dataSource, true);
    }
    this.countryEntities.clear();
    this.dataSource = null;
    this._initialized = false;
  }
}
