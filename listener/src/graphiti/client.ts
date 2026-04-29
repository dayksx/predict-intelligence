import axios from "axios";
import { config } from "../config.js";
import type { MarketEvent } from "../types.js";

const graphiti = axios.create({
  baseURL: config.graphitiUrl,
  headers: { "Content-Type": "application/json" },
  timeout: 30_000,
});

/** Converts a MarketEvent to a compact text summary for Graphiti entity extraction.
 *  Kept short intentionally — fewer tokens = lower LLM cost per episode. */
function toEpisodeBody(m: MarketEvent): string {
  const prob = `YES ${(m.yes_prob * 100).toFixed(0)}% NO ${(m.no_prob * 100).toFixed(0)}%`;
  const vol = `vol $${Math.round(m.volume_usdc).toLocaleString()}`;
  const end = m.resolution_date ? ` resolves ${m.resolution_date.slice(0, 10)}` : "";
  return `[${m.domain}] ${m.title}. ${prob}, ${vol}.${end}`.trim();
}

/** POSTs a single episode to the Graphiti server. */
async function addEpisode(m: MarketEvent): Promise<void> {
  await graphiti.post("/messages", {
    group_id: config.graphitiGroupId,
    messages: [
      {
        name: `polymarket_${m.market_id}`,
        content: toEpisodeBody(m),
        role_type: "user",
        role: "polymarket",
        timestamp: m.fetched_at,
        source_description: `Polymarket prediction market — domain: ${m.domain}`,
      },
    ],
  });
}

/** Sends all markets to Graphiti as episodes; Graphiti handles entity extraction and graph storage. */
export async function ingestMarkets(markets: MarketEvent[]): Promise<void> {
  if (!markets.length) return;

  let ingested = 0;
  for (const m of markets) {
    try {
      await addEpisode(m);
      ingested++;
    } catch (err) {
      console.warn(`  [graphiti] failed to ingest market ${m.market_id}:`, err);
    }
  }

  console.log(`  [graphiti] ingested ${ingested}/${markets.length} episodes`);
}

/** Checks that the Graphiti server is reachable before starting. */
export async function init(): Promise<void> {
  await graphiti.get("/healthcheck");
  console.log(`[graphiti] server reachable at ${config.graphitiUrl}`);
}
