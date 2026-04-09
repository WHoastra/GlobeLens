import {
  Viewer,
  Cartesian3,
  Color,
  PointPrimitiveCollection,
  LabelCollection,
  HorizontalOrigin,
  VerticalOrigin,
  NearFarScalar,
  Cartesian2,
  Entity,
  PolylineGlowMaterialProperty,
  CallbackProperty,
} from "cesium";
import { NewsArticle, NewsCategory } from "@/types";

interface NewsCluster {
  latitude: number;
  longitude: number;
  count: number;
  articles: NewsArticle[];
  category: NewsCategory;
}

const CLUSTER_RADIUS_DEG = 5;
const BEAM_HEIGHT = 500_000;
const TOP_BEAM_COUNT = 10;

const CATEGORY_COLORS: Record<NewsCategory, Color> = {
  conflict: Color.fromCssColorString("#FF3333"),
  finance: Color.fromCssColorString("#33CC33"),
  tech: Color.fromCssColorString("#4A90D9"),
  politics: Color.fromCssColorString("#FFD700"),
  world: Color.WHITE,
};

const CATEGORY_LABELS: Record<NewsCategory, string> = {
  conflict: "WAR",
  finance: "FINANCE",
  tech: "TECH",
  politics: "POLITICS",
  world: "WORLD",
};

function clusterArticles(articles: NewsArticle[]): NewsCluster[] {
  const clusters: NewsCluster[] = [];

  for (const article of articles) {
    let found = false;
    for (const cluster of clusters) {
      // Only cluster within same category
      if (cluster.category !== article.category) continue;
      const dlat = Math.abs(cluster.latitude - article.latitude);
      const dlon = Math.abs(cluster.longitude - article.longitude);
      if (dlat < CLUSTER_RADIUS_DEG && dlon < CLUSTER_RADIUS_DEG) {
        cluster.count++;
        cluster.articles.push(article);
        cluster.latitude = (cluster.latitude * (cluster.count - 1) + article.latitude) / cluster.count;
        cluster.longitude = (cluster.longitude * (cluster.count - 1) + article.longitude) / cluster.count;
        found = true;
        break;
      }
    }
    if (!found) {
      clusters.push({
        latitude: article.latitude,
        longitude: article.longitude,
        count: 1,
        articles: [article],
        category: article.category,
      });
    }
  }

  return clusters.sort((a, b) => b.count - a.count);
}

interface NewsRendererOptions {
  maxClusters?: number;
  topBeamCount?: number;
}

export class NewsRenderer {
  private viewer: Viewer;
  private heatPoints: PointPrimitiveCollection | null = null;
  private pinPoints: PointPrimitiveCollection | null = null;
  private pinLabels: LabelCollection | null = null;
  private beamEntities: { entity: Entity; category: NewsCategory }[] = [];
  private clusters: NewsCluster[] = [];
  private onArticleClick: ((article: NewsArticle, lat: number, lon: number) => void) | null = null;
  private maxClusters: number | undefined;
  private topBeamCountLimit: number;
  private isVisible = true;
  private visibleCategories: Set<NewsCategory> = new Set<NewsCategory>(["conflict", "finance", "tech", "politics", "world"]);

  constructor(viewer: Viewer, options?: NewsRendererOptions) {
    this.viewer = viewer;
    this.maxClusters = options?.maxClusters;
    this.topBeamCountLimit = options?.topBeamCount ?? TOP_BEAM_COUNT;
  }

  init() {
    if (this.viewer.isDestroyed()) return;

    this.heatPoints = this.viewer.scene.primitives.add(
      new PointPrimitiveCollection()
    ) as PointPrimitiveCollection;

    this.pinPoints = this.viewer.scene.primitives.add(
      new PointPrimitiveCollection()
    ) as PointPrimitiveCollection;

    this.pinLabels = this.viewer.scene.primitives.add(
      new LabelCollection()
    ) as LabelCollection;
  }

  setOnArticleClick(cb: (article: NewsArticle, lat: number, lon: number) => void) {
    this.onArticleClick = cb;
  }

  render(articles: NewsArticle[]) {
    if (!this.heatPoints || !this.pinPoints || !this.pinLabels) return;
    if (this.viewer.isDestroyed()) return;

    this.heatPoints.removeAll();
    this.pinPoints.removeAll();
    this.pinLabels.removeAll();
    this.clearBeams();

    // Only render visible categories
    const filtered = articles.filter((a) => this.visibleCategories.has(a.category));

    this.clusters = clusterArticles(filtered);
    if (this.maxClusters) {
      this.clusters = this.clusters.slice(0, this.maxClusters);
    }

    for (let i = 0; i < this.clusters.length; i++) {
      const cluster = this.clusters[i];
      const color = CATEGORY_COLORS[cluster.category] || Color.WHITE;
      const isTopStory = i < this.topBeamCountLimit;

      if (isTopStory) {
        this.renderBeam(cluster, color, i);
      } else {
        this.renderPin(cluster, color);
      }

      // Heatmap glow dot
      this.heatPoints.add({
        position: Cartesian3.fromDegrees(cluster.longitude, cluster.latitude, 50000),
        pixelSize: Math.min(20 + cluster.count * 3, 60),
        color: color.withAlpha(0.4),
        outlineColor: color.withAlpha(0.1),
        outlineWidth: Math.min(cluster.count * 2, 20),
        show: true,
        scaleByDistance: new NearFarScalar(1e6, 2.0, 3e7, 0.8),
        disableDepthTestDistance: 0,
      });
    }
  }

  private renderBeam(cluster: NewsCluster, color: Color, rank: number) {
    const groundPos = Cartesian3.fromDegrees(cluster.longitude, cluster.latitude, 0);
    const topPos = Cartesian3.fromDegrees(cluster.longitude, cluster.latitude, BEAM_HEIGHT);
    const headline = cluster.articles[0]?.title ?? `${cluster.count} stories`;
    const truncatedHeadline = headline.length > 50 ? headline.substring(0, 50) + "..." : headline;
    const categoryLabel = CATEGORY_LABELS[cluster.category] || "NEWS";

    const beamColor = color.withAlpha(rank < 3 ? 0.9 : 0.7);
    const startTime = Date.now();

    // Beam polyline
    const beamEntity = this.viewer.entities.add({
      polyline: {
        positions: [groundPos, topPos],
        width: rank < 3 ? 12 : 8,
        material: new PolylineGlowMaterialProperty({
          glowPower: new CallbackProperty(() => {
            const elapsed = (Date.now() - startTime) / 1000;
            return 0.2 + Math.sin(elapsed * 2) * 0.1;
          }, false) as unknown as number,
          color: beamColor,
        }),
      },
    });
    this.beamEntities.push({ entity: beamEntity, category: cluster.category });

    // Category tag + headline label at top
    const labelEntity = this.viewer.entities.add({
      position: topPos,
      label: {
        text: `${categoryLabel} | ${truncatedHeadline}`,
        font: rank < 3 ? "bold 16px sans-serif" : "bold 13px sans-serif",
        fillColor: Color.WHITE,
        outlineColor: Color.BLACK,
        outlineWidth: 4,
        style: 2,
        horizontalOrigin: HorizontalOrigin.LEFT,
        verticalOrigin: VerticalOrigin.BOTTOM,
        pixelOffset: new Cartesian2(8, -4),
        scaleByDistance: new NearFarScalar(5e5, 1.2, 2e7, 0.6),
        disableDepthTestDistance: 0,
        backgroundColor: Color.fromCssColorString("rgba(0,0,0,0.6)"),
        showBackground: true,
        backgroundPadding: new Cartesian2(6, 4),
      },
    });
    this.beamEntities.push({ entity: labelEntity, category: cluster.category });

    // Count badge
    if (cluster.count > 1) {
      const badgeEntity = this.viewer.entities.add({
        position: Cartesian3.fromDegrees(cluster.longitude, cluster.latitude, BEAM_HEIGHT * 0.85),
        label: {
          text: `${cluster.count} stories`,
          font: "10px sans-serif",
          fillColor: color,
          outlineColor: Color.BLACK,
          outlineWidth: 3,
          style: 2,
          horizontalOrigin: HorizontalOrigin.LEFT,
          verticalOrigin: VerticalOrigin.TOP,
          pixelOffset: new Cartesian2(8, 4),
          scaleByDistance: new NearFarScalar(5e5, 0.8, 2e7, 0.25),
          disableDepthTestDistance: 0,
        },
      });
      this.beamEntities.push({ entity: badgeEntity, category: cluster.category });
    }

    // Ground pin
    if (this.pinPoints) {
      this.pinPoints.add({
        position: Cartesian3.fromDegrees(cluster.longitude, cluster.latitude, 5000),
        pixelSize: 8,
        color: color,
        outlineColor: Color.WHITE,
        outlineWidth: 2,
        show: true,
        scaleByDistance: new NearFarScalar(1e5, 1.5, 2e7, 0.5),
        disableDepthTestDistance: 0,
      });
    }
  }

  private renderPin(cluster: NewsCluster, color: Color) {
    if (!this.pinPoints || !this.pinLabels) return;

    this.pinPoints.add({
      position: Cartesian3.fromDegrees(cluster.longitude, cluster.latitude, 100000),
      pixelSize: 6,
      color: color,
      outlineColor: Color.WHITE.withAlpha(0.8),
      outlineWidth: 1,
      show: true,
      scaleByDistance: new NearFarScalar(1e6, 1.5, 3e7, 0.6),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    });

    const label = cluster.count > 1
      ? `${cluster.count} stories`
      : cluster.articles[0]?.title.substring(0, 40) + "...";

    this.pinLabels.add({
      position: Cartesian3.fromDegrees(cluster.longitude, cluster.latitude, 120000),
      text: label,
      font: "10px sans-serif",
      fillColor: Color.WHITE.withAlpha(0.9),
      outlineColor: Color.BLACK,
      outlineWidth: 2,
      style: 2,
      horizontalOrigin: HorizontalOrigin.LEFT,
      verticalOrigin: VerticalOrigin.CENTER,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pixelOffset: { x: 12, y: 0 } as any,
      scaleByDistance: new NearFarScalar(1e6, 1.0, 2e7, 0.4),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      show: true,
    });
  }

  private clearBeams() {
    for (const { entity } of this.beamEntities) {
      this.viewer.entities.remove(entity);
    }
    this.beamEntities = [];
  }

  /** Re-render with updated category visibility */
  setVisibleCategories(categories: Set<NewsCategory>, articles?: NewsArticle[]) {
    this.visibleCategories = categories;
    if (articles) {
      this.render(articles);
    }
  }

  /** Try to handle a click at the given lat/lon. Returns true if a news cluster was found. */
  tryClick(clickLat: number, clickLon: number): boolean {
    let nearest: NewsCluster | null = null;
    let nearestDist = Infinity;
    for (const c of this.clusters) {
      const dist = Math.sqrt((c.latitude - clickLat) ** 2 + (c.longitude - clickLon) ** 2);
      if (dist < nearestDist && dist < 5) {
        nearest = c;
        nearestDist = dist;
      }
    }

    if (nearest && this.onArticleClick) {
      const topArticle = nearest.articles[0];
      this.onArticleClick(topArticle, nearest.latitude, nearest.longitude);
      return true;
    }
    return false;
  }

  enableClickHandler() {
    // Click handling is now done via tryClick() from GlobeViewer's unified handler
  }

  setVisible(visible: boolean) {
    this.isVisible = visible;
    if (this.heatPoints) this.heatPoints.show = visible;
    if (this.pinPoints) this.pinPoints.show = visible;
    if (this.pinLabels) this.pinLabels.show = visible;
    for (const { entity } of this.beamEntities) {
      entity.show = visible;
    }
  }

  destroy() {
    this.clearBeams();
    if (this.heatPoints && !this.viewer.isDestroyed()) {
      this.viewer.scene.primitives.remove(this.heatPoints);
    }
    if (this.pinPoints && !this.viewer.isDestroyed()) {
      this.viewer.scene.primitives.remove(this.pinPoints);
    }
    if (this.pinLabels && !this.viewer.isDestroyed()) {
      this.viewer.scene.primitives.remove(this.pinLabels);
    }
    this.heatPoints = null;
    this.pinPoints = null;
    this.pinLabels = null;
  }
}
