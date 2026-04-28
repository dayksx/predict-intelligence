import { ALL_DOMAINS, type Domain } from "./types.js";

/** Parses MARKET_CATEGORIES env var into a Domain array; defaults to all domains. */
function parseCategories(raw: string | undefined): Domain[] {
  if (!raw) return [...ALL_DOMAINS];
  return raw.split(",").map((s) => s.trim()) as Domain[];
}

export const config = {
  intervalHours: parseFloat(process.env.INTERVAL_HOURS ?? "24"),

  neo4j: {
    uri: process.env.GRAPHITI_NEO4J_URI ?? "bolt://localhost:7687",
    user: process.env.GRAPHITI_NEO4J_USER ?? "neo4j",
    password: process.env.GRAPHITI_NEO4J_PASSWORD ?? "password",
    group: process.env.GRAPHITI_GROUP_PREFIX ?? "predict",
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? "",
    embeddingModel: "text-embedding-3-small",
    embeddingBatchSize: 100,
  },

  polymarket: {
    gammaUrl: process.env.POLYMARKET_GAMMA_URL ?? "https://gamma-api.polymarket.com",
    fetchLimit: 500,
    categories: parseCategories(process.env.MARKET_CATEGORIES),
  },
} as const;
