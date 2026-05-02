import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { resolve } from "path";

const REGISTRY_FILE = process.env.MARKET_REGISTRY_FILE ?? resolve("../data/market_registry.json");

export interface RegistryEntry {
  market_id: string;
  title: string;
  clob_yes_token_id?: string;
  clob_no_token_id?: string;
  neg_risk?: boolean;
  resolution_date?: string;
  domain: string;
  updated_at: string;
}

export async function readMarketRegistry(): Promise<Record<string, RegistryEntry>> {
  if (!existsSync(REGISTRY_FILE)) return {};
  const raw = await readFile(REGISTRY_FILE, "utf-8");
  return JSON.parse(raw) as Record<string, RegistryEntry>;
}

/** Returns the most recently updated_at timestamp across all registry entries. */
export function latestRegistryUpdate(registry: Record<string, RegistryEntry>): string | null {
  const timestamps = Object.values(registry).map((e) => e.updated_at).filter(Boolean);
  if (timestamps.length === 0) return null;
  return timestamps.sort().at(-1) ?? null;
}
