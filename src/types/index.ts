/* ── News ──────────────────────────────────────────── */
export type NewsCategory = "conflict" | "finance" | "tech" | "politics" | "world";

export const NEWS_CATEGORIES: { key: NewsCategory; label: string; color: string }[] = [
  { key: "conflict", label: "War", color: "#FF3333" },
  { key: "finance", label: "Finance", color: "#33CC33" },
  { key: "tech", label: "Tech", color: "#4A90D9" },
  { key: "politics", label: "Politics", color: "#FFD700" },
  { key: "world", label: "World", color: "#FFFFFF" },
];

export interface NewsArticle {
  id: string;
  title: string;
  text: string;
  url: string;
  image?: string;
  source: string;
  publishDate: string;
  latitude: number;
  longitude: number;
  category: NewsCategory;
  location?: string;
}

/* ── Weather ───────────────────────────────────────── */
export interface WeatherData {
  latitude: number;
  longitude: number;
  locationName: string;
  temperature: number; // °C
  feelsLike: number;
  humidity: number; // %
  windSpeed: number; // km/h
  windDirection: number; // degrees
  weatherCode: number;
  description: string;
  isDay: boolean;
}

/* ── Webcams ───────────────────────────────────────── */
export interface Webcam {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  thumbnailUrl: string;
  previewUrl?: string;
  playerUrl?: string;
  lastUpdated: string;
  status: "active" | "inactive";
  country?: string;
  city?: string;
}

/* ── Traffic ───────────────────────────────────────── */
export interface TrafficIncident {
  id: string;
  type: "accident" | "congestion" | "construction" | "event" | "other";
  severity: 1 | 2 | 3 | 4; // 1=low, 4=critical
  description: string;
  latitude: number;
  longitude: number;
  startTime: string;
  endTime?: string;
  roadName?: string;
  delay?: number; // seconds
}

export interface TrafficFlow {
  latitude: number;
  longitude: number;
  currentSpeed: number; // km/h
  freeFlowSpeed: number; // km/h
  confidence: number;
  roadClosure: boolean;
}

/* ── Globe / Map ───────────────────────────────────── */
export interface MapPin {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  type: "news" | "weather" | "webcam" | "traffic";
  data: NewsArticle | WeatherData | Webcam | TrafficIncident;
}

/* ── Weather Tile Layers ──────────────────────────── */
export type WeatherTileLayerKey = "clouds_new" | "precipitation_new" | "temp_new" | "wind_new";

/* ── Artemis Views ────────────────────────────────── */
export type ArtemisViewMode = "none" | "earth-orbit" | "lunar-transit" | "flyby-return";

/* ── Layer Toggle ──────────────────────────────────── */
export type LayerType = "news" | "weather" | "webcams" | "traffic" | "satellites";

export interface LayerState {
  news: boolean;
  weather: boolean;
  webcams: boolean;
  traffic: boolean;
  satellites: boolean;
}
