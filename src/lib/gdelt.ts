import { NewsArticle } from "@/types";
import { getCountryCoords } from "./countryCoords";

const GDELT_API_BASE = "https://api.gdeltproject.org/api/v2";

/** Parse GDELT date format (YYYYMMDDTHHmmSS) to ISO string */
function parseGdeltDate(raw: string): string {
  if (!raw || raw.length < 8) return raw;
  const y = raw.slice(0, 4);
  const m = raw.slice(4, 6);
  const d = raw.slice(6, 8);
  return `${y}-${m}-${d}`;
}

/**
 * Fetch geolocated news articles from the GDELT Project.
 * GDELT is free and requires no API key.
 * Articles are geocoded by source country.
 */
export async function fetchGdeltNews(
  query?: string,
  maxRecords = 100
): Promise<NewsArticle[]> {
  const params = new URLSearchParams({
    query: (query || "world") + " sourcelang:English",
    mode: "ArtList",
    maxrecords: String(maxRecords),
    format: "json",
    sort: "DateDesc",
  });

  const res = await fetch(`${GDELT_API_BASE}/doc/doc?${params}`, {
    headers: { "User-Agent": "GlobeLens/1.0" },
    next: { revalidate: 900 }, // cache for 15 minutes
  });
  if (!res.ok) throw new Error(`GDELT API error: ${res.status}`);

  const data = await res.json();
  const articles = data.articles ?? [];

  return articles
    .filter((a: Record<string, string>) => a.seendate && a.title)
    .map((a: Record<string, string>, i: number) => {
      // Geocode by country
      const coords = getCountryCoords(a.sourcecountry || "");
      return {
        id: `gdelt-${i}-${Date.now()}`,
        title: a.title,
        text: a.title,
        url: a.url,
        image: a.socialimage || undefined,
        source: a.domain || "GDELT",
        publishDate: parseGdeltDate(a.seendate),
        latitude: coords ? coords[0] : 0,
        longitude: coords ? coords[1] : 0,
        category: a.sourcecountry ?? undefined,
      };
    })
    .filter((a: NewsArticle) => a.latitude !== 0 || a.longitude !== 0);
}
