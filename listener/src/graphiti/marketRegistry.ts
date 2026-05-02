import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { dirname, resolve } from "path";
import type { MarketEvent } from "../types.js";

/** Serialised shape stored in the registry JSON file. */
export interface RegistryEntry {
  market_id: string;
  title: string;
  clob_yes_token_id: string | null;
  clob_no_token_id: string | null;
  neg_risk: boolean;
  resolution_date: string | null;
  domain: string;
  updated_at: string;
}

type Registry = Record<string, RegistryEntry>;

const REGISTRY_FILE = process.env.MARKET_REGISTRY_FILE ?? resolve("data/market_registry.json");

async function load(): Promise<Registry> {
  if (!existsSync(REGISTRY_FILE)) return {};
  return JSON.parse(await readFile(REGISTRY_FILE, "utf-8")) as Registry;
}

async function save(registry: Registry): Promise<void> {
  await mkdir(dirname(REGISTRY_FILE), { recursive: true });
  await writeFile(REGISTRY_FILE, JSON.stringify(registry, null, 2));
}

/** Upserts all markets into the registry file.
 *  Existing entries are updated (token IDs and dates never change, but prices may shift).
 *  Markets that disappear from Polymarket are left in place — they may still have open positions. */
export async function updateRegistry(markets: MarketEvent[]): Promise<void> {
  const registry = await load();
  const now = new Date().toISOString();

  for (const m of markets) {
    registry[m.market_id] = {
      market_id:         m.market_id,
      title:             m.title,
      clob_yes_token_id: m.clob_yes_token_id,
      clob_no_token_id:  m.clob_no_token_id,
      neg_risk:          m.neg_risk,
      resolution_date:   m.resolution_date,
      domain:            m.domain,
      updated_at:        now,
    };
  }

  await save(registry);
  console.log(`[registry] upserted ${markets.length} markets → ${REGISTRY_FILE} (${Object.keys(registry).length} total)`);
}
