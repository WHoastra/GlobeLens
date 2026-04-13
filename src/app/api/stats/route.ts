import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_DIR = join(process.cwd(), ".cache", "stats");

const AGGREGATES = new Set([
  "AFE","AFW","ARB","CEB","CSS","EAP","EAS","ECA","ECS","EMU","EUU",
  "FCS","HIC","HPC","IBD","IBT","IDA","IDB","IDX","INX","LAC","LCN",
  "LDC","LIC","LMC","LMY","LTE","MEA","MIC","MNA","NAC","OED","OSS",
  "PRE","PSS","PST","SAS","SSA","SSF","SST","TEA","TEC","TLA","TMN",
  "TSA","TSS","UMC","WLD",
]);

function getCachePath(indicator: string) {
  return join(CACHE_DIR, `${indicator.replace(/\./g, "_")}.json`);
}

function readCache(indicator: string) {
  const path = getCachePath(indicator);
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8"));
    if (Date.now() - raw.timestamp < CACHE_TTL) return raw.data;
  } catch { /* ignore */ }
  return null;
}

function writeCache(indicator: string, data: unknown) {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(getCachePath(indicator), JSON.stringify({ data, timestamp: Date.now() }));
}

export async function GET(req: NextRequest) {
  const indicator = req.nextUrl.searchParams.get("indicator");
  if (!indicator) {
    return NextResponse.json({ error: "indicator parameter required" }, { status: 400 });
  }

  const cached = readCache(indicator);
  if (cached) return NextResponse.json(cached);

  try {
    const url = `https://api.worldbank.org/v2/country/all/indicator/${indicator}?format=json&date=2020:2023&per_page=2000`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`World Bank API returned ${res.status}`);

    const json = await res.json();
    if (!Array.isArray(json) || json.length < 2 || !Array.isArray(json[1])) {
      return NextResponse.json({ indicator, countries: [] });
    }

    // Group by country, keep most recent year with data
    const countryMap = new Map<string, { countryCode: string; countryCode2: string; countryName: string; value: number; year: number }>();
    for (const r of json[1]) {
      if (r.value === null || r.value === undefined) continue;
      const iso3 = r.countryiso3code;
      if (!iso3 || AGGREGATES.has(iso3)) continue;

      const year = parseInt(r.date);
      const existing = countryMap.get(iso3);
      if (!existing || year > existing.year) {
        countryMap.set(iso3, {
          countryCode: iso3,
          countryCode2: r.country.id,
          countryName: r.country.value,
          value: r.value,
          year,
        });
      }
    }

    const countries = Array.from(countryMap.values());
    const result = { indicator, countries };

    writeCache(indicator, result);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
