import { ALL_DOMAINS, type Domain } from "./types.js";

/** Parses MARKET_CATEGORIES env var into a Domain array; defaults to all domains. */
function parseCategories(raw: string | undefined): Domain[] {
  if (!raw) return [...ALL_DOMAINS];
  return raw.split(",").map((s) => s.trim()) as Domain[];
}

export const config = {
  intervalHours: parseFloat(process.env.INTERVAL_HOURS ?? "24"),

  graphitiUrl: process.env.GRAPHITI_URL ?? "http://localhost:8000",
  graphitiGroupId: process.env.GRAPHITI_GROUP_ID ?? "predict",

  polymarket: {
    gammaUrl: process.env.POLYMARKET_GAMMA_URL ?? "https://gamma-api.polymarket.com",
    fetchLimit: parseInt(process.env.POLYMARKET_FETCH_LIMIT ?? "50"),
    categories: parseCategories(process.env.MARKET_CATEGORIES),
  },
} as const;
