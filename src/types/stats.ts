export interface StatIndicator {
  code: string;
  label: string;
  format: "currency-large" | "currency" | "percent" | "number-large" | "number";
}

export interface StatCategory {
  key: string;
  label: string;
  colorScale: [string, string]; // [low, high] hex colors
  indicators: StatIndicator[];
}

export interface CountryStat {
  countryCode: string;  // ISO3
  countryCode2: string; // ISO2
  countryName: string;
  value: number;
  year: number;
}

export interface StatsResponse {
  indicator: string;
  countries: CountryStat[];
}

export const STAT_CATEGORIES: StatCategory[] = [
  {
    key: "economy",
    label: "Economy",
    colorScale: ["#C8E6C9", "#1B5E20"],
    indicators: [
      { code: "NY.GDP.MKTP.CD", label: "GDP Total", format: "currency-large" },
      { code: "NY.GDP.PCAP.CD", label: "GDP Per Capita", format: "currency" },
      { code: "NY.GDP.MKTP.KD.ZG", label: "GDP Growth %", format: "percent" },
      { code: "FP.CPI.TOTL.ZG", label: "Inflation %", format: "percent" },
      { code: "SL.UEM.TOTL.ZS", label: "Unemployment %", format: "percent" },
    ],
  },
  {
    key: "demographics",
    label: "Demographics",
    colorScale: ["#BBDEFB", "#0D47A1"],
    indicators: [
      { code: "SP.POP.TOTL", label: "Population", format: "number-large" },
      { code: "SP.POP.GROW", label: "Pop. Growth %", format: "percent" },
      { code: "SP.DYN.LE00.IN", label: "Life Expectancy", format: "number" },
      { code: "SP.URB.TOTL.IN.ZS", label: "Urban Pop. %", format: "percent" },
    ],
  },
  {
    key: "development",
    label: "Development",
    colorScale: ["#E1BEE7", "#4A148C"],
    indicators: [
      { code: "SI.POV.DDAY", label: "Poverty Rate %", format: "percent" },
      { code: "SE.ADT.LITR.ZS", label: "Literacy Rate %", format: "percent" },
      { code: "EG.ELC.ACCS.ZS", label: "Electricity %", format: "percent" },
      { code: "IT.NET.USER.ZS", label: "Internet Users %", format: "percent" },
    ],
  },
  {
    key: "health",
    label: "Health",
    colorScale: ["#FFCDD2", "#B71C1C"],
    indicators: [
      { code: "SH.XPD.CHEX.GD.ZS", label: "Health Spend % GDP", format: "percent" },
      { code: "SP.DYN.IMRT.IN", label: "Infant Mortality", format: "number" },
      { code: "EN.ATM.CO2E.PC", label: "CO2 per Capita", format: "number" },
    ],
  },
  {
    key: "military",
    label: "Military",
    colorScale: ["#FFE0B2", "#E65100"],
    indicators: [
      { code: "MS.MIL.XPND.GD.ZS", label: "Military % GDP", format: "percent" },
    ],
  },
  {
    key: "trade",
    label: "Trade",
    colorScale: ["#B2DFDB", "#004D40"],
    indicators: [
      { code: "NE.EXP.GNFS.CD", label: "Exports", format: "currency-large" },
      { code: "NE.IMP.GNFS.CD", label: "Imports", format: "currency-large" },
    ],
  },
];

export function formatStatValue(value: number, format: string): string {
  switch (format) {
    case "currency-large":
      if (Math.abs(value) >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
      if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
      if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
      return `$${Math.round(value).toLocaleString()}`;
    case "currency":
      return `$${Math.round(value).toLocaleString()}`;
    case "percent":
      return `${value.toFixed(1)}%`;
    case "number-large":
      if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
      if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
      if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
      return Math.round(value).toLocaleString();
    case "number":
      return value.toFixed(1);
    default:
      return value.toLocaleString();
  }
}

export function countryFlag(iso2: string): string {
  if (!iso2 || iso2.length !== 2) return "";
  return String.fromCodePoint(
    ...iso2.toUpperCase().split("").map(c => c.charCodeAt(0) + 0x1F1A5)
  );
}
