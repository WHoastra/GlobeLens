import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Fallback ISS crew data (Expedition 72/73 as of early 2026)
const FALLBACK_CREW = {
  number: 7,
  people: [
    { craft: "ISS", name: "Oleg Kononenko" },
    { craft: "ISS", name: "Nikolai Chub" },
    { craft: "ISS", name: "Tracy Dyson" },
    { craft: "ISS", name: "Matthew Dominick" },
    { craft: "ISS", name: "Michael Barratt" },
    { craft: "ISS", name: "Jeanette Epps" },
    { craft: "ISS", name: "Alexander Grebenkin" },
  ],
  message: "success",
};

export async function GET() {
  // Try the open-notify API (HTTP only — they don't support HTTPS)
  try {
    const res = await fetch("http://api.open-notify.org/astros.json", {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`ISS crew API error: ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    // API is unreliable — return fallback crew data
    console.warn("[ISS Crew] open-notify API unreachable, using fallback data");
    return NextResponse.json(FALLBACK_CREW);
  }
}
