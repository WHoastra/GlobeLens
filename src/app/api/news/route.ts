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
const CATEGORY_QUERIES = [
  { category: "conflict", query: "(war OR military OR conflict OR attack OR missile OR troops OR airstrike OR bombing) sourcelang:English" },
  { category: "finance", query: "(economy OR markets OR stocks OR inflation OR trade OR GDP) sourcelang:English" },
  { category: "tech", query: "(AI OR technology OR startup OR cyber OR software OR chip OR robotics OR SpaceX) sourcelang:English" },
  { category: "politics", query: "(election OR congress OR president OR legislation OR government OR policy OR sanctions OR parliament) sourcelang:English" },
  { category: "world", query: "world sourcelang:English" },
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

// ── GDELT Fetch (per category) ────────────────────────────────
async function fetchCategoryArticles(
  category: string,
  query: string
): Promise<(Record<string, string> & { category: string })[]> {
  const params = new URLSearchParams({
    query,
    mode: "ArtList",
    maxrecords: "50",
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

// ── Fetch all categories in parallel ──────────────────────────
async function fetchAllCategories(): Promise<(Record<string, string> & { category: string })[]> {
  const results = await Promise.allSettled(
    CATEGORY_QUERIES.map(({ category, query }) =>
      fetchCategoryArticles(category, query)
    )
  );

  const allArticles: (Record<string, string> & { category: string })[] = [];
  const seen = new Set<string>();

  for (const result of results) {
    if (result.status === "fulfilled") {
      for (const article of result.value) {
        // Deduplicate by URL
        if (!seen.has(article.url)) {
          seen.add(article.url);
          allArticles.push(article);
        }
      }
    } else {
      console.warn("[News API] Category fetch failed:", result.reason);
    }
  }

  return allArticles;
}

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
  }));

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 16000,
    system:
      "You are a precise geocoding assistant. Given a list of news articles with their titles, sources, and source countries, determine the most accurate latitude and longitude for where each story takes place. Use context from the headline to identify the specific city, region, or landmark — not just the country centroid. If the headline mentions a specific place (e.g. 'Strait of Hormuz', 'Paris', 'Capitol Hill'), use that location. If no specific location can be determined from the headline, use the capital city of the source country as a fallback. Respond ONLY with a valid JSON array, no markdown, no explanation.",
    messages: [{ role: "user", content: JSON.stringify(batch) }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error("Claude response is not an array");
  return parsed;
}

// ── Fallback: country centroid geocoding ────────────────────────
function geocodeWithCountryCentroids(
  articles: Record<string, string>[]
): { index: number; lat: number; lng: number; location: string }[] {
  return articles.map((a, i) => {
    const coords = getCountryCoords(a.sourcecountry || "");
    return {
      index: i,
      lat: coords ? coords[0] : 0,
      lng: coords ? coords[1] : 0,
      location: a.sourcecountry || "Unknown",
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
      coords = geocodeWithCountryCentroids(articles);
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
