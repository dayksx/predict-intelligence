import axios from "axios";
import { config } from "../config.js";
import type { MarketEvent } from "../types.js";

const graphiti = axios.create({
  baseURL: config.graphitiUrl,
  headers: { "Content-Type": "application/json" },
  timeout: 30_000,
});

/** Converts a MarketEvent into a declarative sentence Graphiti can extract as a probability fact.
 *  Written as a statement rather than a label so the LLM creates a "X has Y% probability" fact.
 *  Includes market_id so the agent can resolve it back to the registry for CLOB trading. */
function toEpisodeBody(m: MarketEvent): string {
  const yesPct = (m.yes_prob * 100).toFixed(0);
  const noPct  = (m.no_prob  * 100).toFixed(0);
  const vol    = `$${Math.round(m.volume_usdc).toLocaleString()} USDC`;
  const end    = m.resolution_date ? ` Resolves ${m.resolution_date.slice(0, 10)}.` : "";
  const ids    = `market_id:${m.market_id}` +
                 (m.clob_yes_token_id ? ` clob_yes:${m.clob_yes_token_id}` : "") +
                 (m.clob_no_token_id  ? ` clob_no:${m.clob_no_token_id}`   : "") +
                 (m.neg_risk          ? " neg_risk:true"                     : "");
  return (
    `[${m.domain}] "${m.title}" has a ${yesPct}% YES probability and ${noPct}% NO probability ` +
    `on Polymarket with ${vol} trading volume.${end} ${ids}`
  ).trim();
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
      // Small delay to avoid overwhelming the LiteLLM proxy
      await new Promise((r) => setTimeout(r, 300));
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
