import { NewsArticle } from "@/types";

const NEWS_API_BASE = "https://api.worldnewsapi.com";

/**
 * Fetch geolocated world news from World News API.
 * Requires WORLD_NEWS_API_KEY in env.
 */
export async function fetchWorldNews(
  query?: string,
  count = 20
): Promise<NewsArticle[]> {
  const apiKey = process.env.WORLD_NEWS_API_KEY;
  if (!apiKey) throw new Error("WORLD_NEWS_API_KEY is not set");

  const params = new URLSearchParams({
    text: query || "",
    language: "en",
    number: String(count),
    "sort-direction": "DESC",
    sort: "publish-time",
  });

  const res = await fetch(`${NEWS_API_BASE}/search-news?${params}`, {
    headers: { "x-api-key": apiKey },
  });
  if (!res.ok) throw new Error(`World News API error: ${res.status}`);

  const data = await res.json();
  const articles = data.news ?? [];

  return articles.map((a: Record<string, string | number>) => ({
    id: `wna-${a.id}`,
    title: a.title,
    text: a.text ?? "",
    url: a.url,
    image: a.image || undefined,
    source: a.source_country ?? a.author ?? "World News API",
    publishDate: a.publish_date,
    latitude: a.latitude ?? 0,
    longitude: a.longitude ?? 0,
    category: a.category ?? undefined,
  }));
}
