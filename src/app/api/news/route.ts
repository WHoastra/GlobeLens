import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
import { getCountryCoords } from "@/lib/countryCoords";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

// ── Types ──────────────────────────────────────────────────────
interface GeocodedArticle {
  title: string;
  url: string;
  socialimage: string;
  domain: string;
  sourcecountry: string;
  seendate: string;
  lat: number;
  lng: number;
  location: string;
  category: string;
}

// ── Category Queries ──────────────────────────────────────────
// One focused keyword per category to avoid GDELT rate limits
const CATEGORY_QUERIES = [
  { category: "conflict", query: "war sourcelang:English", maxrecords: 50 },
  { category: "finance", query: "stocks sourcelang:English", maxrecords: 50 },
  { category: "tech", query: "AI sourcelang:English", maxrecords: 50 },
  { category: "politics", query: "election sourcelang:English", maxrecords: 50 },
  { category: "world", query: "world sourcelang:English", maxrecords: 50 },
];

// ── File-based Cache ──────────────────────────────────────────
const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours
const CACHE_DIR = join(process.cwd(), ".cache");
const CACHE_FILE = join(CACHE_DIR, "news-geocoded.json");

function readCache(): { data: GeocodedArticle[]; timestamp: number } | null {
  try {
    if (!existsSync(CACHE_FILE)) return null;
    const raw = readFileSync(CACHE_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp < CACHE_TTL) return parsed;
    return null;
  } catch {
    return null;
  }
}

function writeCache(data: GeocodedArticle[]) {
  try {
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    // non-critical
  }
}

// ── GDELT Fetch (per query) ───────────────────────────────────
async function fetchCategoryArticles(
  category: string,
  query: string,
  maxrecords = 50
): Promise<(Record<string, string> & { category: string })[]> {
  const params = new URLSearchParams({
    query,
    mode: "ArtList",
    maxrecords: String(maxrecords),
    format: "json",
    sort: "DateDesc",
  });

  const res = await fetch(
    `https://api.gdeltproject.org/api/v2/doc/doc?${params}`,
    { headers: { "User-Agent": "GlobeLens/1.0" } }
  );
  if (!res.ok) throw new Error(`GDELT ${category}: ${res.status}`);

  const data = await res.json();
  return (data.articles ?? [])
    .filter((a: Record<string, string>) => a.title && a.sourcecountry)
    .map((a: Record<string, string>) => ({ ...a, category }));
}

// ── Fetch all categories sequentially to avoid GDELT rate limits ──
async function fetchAllCategories(): Promise<(Record<string, string> & { category: string })[]> {
  const allArticles: (Record<string, string> & { category: string })[] = [];
  const seen = new Set<string>();

  for (const { category, query, maxrecords } of CATEGORY_QUERIES) {
    try {
      const articles = await fetchCategoryArticles(category, query, maxrecords);
      for (const article of articles) {
        if (!seen.has(article.url)) {
          seen.add(article.url);
          allArticles.push(article);
        }
      }
      console.log(`[News API] ${category}: ${articles.length} articles`);
    } catch (e) {
      console.warn(`[News API] ${category} fetch failed:`, e);
    }
    // Small delay between requests to avoid GDELT 429
    await new Promise((r) => setTimeout(r, 500));
  }

  return allArticles;
}

// ── Major cities for fallback distribution ────────────────────
const MAJOR_CITIES: Record<string, [number, number, string][]> = {
  "United States": [
    [38.90, -77.04, "Washington DC"], [40.71, -74.01, "New York"],
    [34.05, -118.24, "Los Angeles"], [41.88, -87.63, "Chicago"],
    [29.76, -95.37, "Houston"], [33.45, -112.07, "Phoenix"],
    [37.77, -122.42, "San Francisco"], [47.61, -122.33, "Seattle"],
    [25.76, -80.19, "Miami"], [42.36, -71.06, "Boston"],
    [39.74, -104.99, "Denver"], [32.78, -96.80, "Dallas"],
  ],
  "United Kingdom": [
    [51.51, -0.13, "London"], [53.48, -2.24, "Manchester"],
    [55.95, -3.19, "Edinburgh"], [52.49, -1.89, "Birmingham"],
  ],
  "India": [
    [28.61, 77.21, "New Delhi"], [19.08, 72.88, "Mumbai"],
    [13.08, 80.27, "Chennai"], [22.57, 88.36, "Kolkata"],
    [12.97, 77.59, "Bangalore"],
  ],
  "China": [
    [39.90, 116.41, "Beijing"], [31.23, 121.47, "Shanghai"],
    [23.13, 113.26, "Guangzhou"], [22.54, 114.06, "Shenzhen"],
    [30.57, 104.07, "Chengdu"],
  ],
  "Germany": [
    [52.52, 13.41, "Berlin"], [48.14, 11.58, "Munich"],
    [50.11, 8.68, "Frankfurt"], [53.55, 9.99, "Hamburg"],
  ],
  "France": [
    [48.86, 2.35, "Paris"], [43.30, 5.37, "Marseille"],
    [45.76, 4.84, "Lyon"], [43.61, 1.44, "Toulouse"],
  ],
  "Japan": [
    [35.68, 139.69, "Tokyo"], [34.69, 135.50, "Osaka"],
    [35.01, 135.77, "Kyoto"], [43.06, 141.35, "Sapporo"],
  ],
  "Australia": [
    [-33.87, 151.21, "Sydney"], [-37.81, 144.96, "Melbourne"],
    [-27.47, 153.03, "Brisbane"], [-31.95, 115.86, "Perth"],
  ],
  "Canada": [
    [45.42, -75.70, "Ottawa"], [43.65, -79.38, "Toronto"],
    [49.28, -123.12, "Vancouver"], [45.50, -73.57, "Montreal"],
  ],
  "Brazil": [
    [-15.79, -47.88, "Brasilia"], [-23.55, -46.63, "Sao Paulo"],
    [-22.91, -43.17, "Rio de Janeiro"], [-12.97, -38.51, "Salvador"],
  ],
  "Russia": [
    [55.76, 37.62, "Moscow"], [59.93, 30.32, "St Petersburg"],
    [56.84, 60.60, "Yekaterinburg"], [55.03, 82.92, "Novosibirsk"],
  ],
};

// ── Claude Geocoding ───────────────────────────────────────────
async function geocodeWithClaude(
  articles: Record<string, string>[]
): Promise<{ index: number; lat: number; lng: number; location: string }[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const client = new Anthropic({ apiKey });

  const batch = articles.map((a, i) => ({
    index: i,
    title: a.title,
    source: a.domain,
    sourcecountry: a.sourcecountry,
    url: a.url,
  }));

  const response = await client.messages.create({
    model: "claude-3-5-haiku-20241022",
    max_tokens: 16000,
    system: `You are a precise geocoding assistant. For each news article, return the latitude and longitude of the SPECIFIC CITY where the story takes place.

RULES:
1. NEVER return a country centroid or geographic center. Always pick a real city.
2. If the headline mentions a specific place (Paris, Wall Street, Capitol Hill, Silicon Valley), use that exact location.
3. If the headline mentions a country but no city, use the CAPITAL CITY of that country.
4. If the source domain hints at a city (chicagotribune.com = Chicago, bbc.co.uk = London, nytimes.com = New York), use that city.
5. For US news about politics/government with no city mentioned, use Washington DC (38.90, -77.04).
6. For US news about finance/stocks with no city, use New York (40.71, -74.01).
7. For US news about tech with no city, use San Francisco (37.77, -122.42).
8. For other generic US news, distribute across: New York, Los Angeles, Chicago, Houston, Miami, Seattle.
9. NEVER place multiple articles at the exact same coordinates. Vary by at least 0.1 degrees.

Respond ONLY with a valid JSON array: [{"index":0,"lat":40.71,"lng":-74.01,"location":"New York"}]`,
    messages: [{ role: "user", content: JSON.stringify(batch) }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error("Claude response is not an array");
  return parsed;
}

// ── Fallback: distribute across major cities ──────────────────
function geocodeWithCityDistribution(
  articles: Record<string, string>[]
): { index: number; lat: number; lng: number; location: string }[] {
  const countryCounters: Record<string, number> = {};

  return articles.map((a, i) => {
    const country = a.sourcecountry || "";
    const cities = MAJOR_CITIES[country];

    if (cities && cities.length > 0) {
      const idx = (countryCounters[country] || 0) % cities.length;
      countryCounters[country] = idx + 1;
      const [lat, lng, name] = cities[idx];
      // Add small random offset to prevent exact overlap
      const jitter = () => (Math.random() - 0.5) * 0.2;
      return { index: i, lat: lat + jitter(), lng: lng + jitter(), location: name };
    }

    // Fallback to country centroid with jitter
    const coords = getCountryCoords(country);
    const jitter = () => (Math.random() - 0.5) * 2;
    return {
      index: i,
      lat: coords ? coords[0] + jitter() : 0,
      lng: coords ? coords[1] + jitter() : 0,
      location: country || "Unknown",
    };
  });
}

// ── Merge with coordinates ────────────────────────────────────
function mergeArticlesWithCoords(
  articles: (Record<string, string> & { category: string })[],
  coords: { index: number; lat: number; lng: number; location: string }[]
): GeocodedArticle[] {
  const coordMap = new Map(coords.map((c) => [c.index, c]));

  return articles
    .map((a, i) => {
      const geo = coordMap.get(i);
      if (!geo || (geo.lat === 0 && geo.lng === 0)) return null;

      return {
        title: a.title,
        url: a.url,
        socialimage: a.socialimage || "",
        domain: a.domain || "",
        sourcecountry: a.sourcecountry || "",
        seendate: a.seendate || "",
        lat: geo.lat,
        lng: geo.lng,
        location: geo.location,
        category: a.category,
      };
    })
    .filter((a): a is GeocodedArticle => a !== null);
}

// ── API Route ──────────────────────────────────────────────────
export async function GET() {
  const cached = readCache();
  if (cached) {
    console.log("[News API] Serving from cache (" + cached.data.length + " articles)");
    return NextResponse.json(cached.data);
  }

  try {
    console.log("[News API] Fetching 5 categories from GDELT...");
    const articles = await fetchAllCategories();
    console.log(`[News API] Got ${articles.length} articles across categories`);

    let coords;
    try {
      console.log("[News API] Geocoding with Claude...");
      coords = await geocodeWithClaude(articles);
      console.log(`[News API] Claude geocoded ${coords.length} articles`);
    } catch (e) {
      console.warn("[News API] Claude geocoding failed, using country centroids:", e);
      coords = geocodeWithCityDistribution(articles);
    }

    const result = mergeArticlesWithCoords(articles, coords);
    writeCache(result);
    console.log(`[News API] Cached ${result.length} geocoded articles`);

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[News API] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
