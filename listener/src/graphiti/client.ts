import neo4j from "neo4j-driver";
import OpenAI from "openai";
import type { MarketEvent } from "../sources/predictionMarkets.js";

const driver = neo4j.driver(
  process.env.GRAPHITI_NEO4J_URI ?? "bolt://localhost:7687",
  neo4j.auth.basic(
    process.env.GRAPHITI_NEO4J_USER ?? "neo4j",
    process.env.GRAPHITI_NEO4J_PASSWORD ?? "password"
  )
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const GROUP = process.env.GRAPHITI_GROUP_PREFIX ?? "predict";

async function embed(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return res.data[0]!.embedding;
}

export async function ingestMarkets(markets: MarketEvent[]): Promise<void> {
  const session = driver.session();

  try {
    for (const m of markets) {
      const text = `${m.title} ${m.description}`.trim();
      const embedding = await embed(text);

      await session.run(
        `MERGE (m:Market {market_id: $market_id, group: $group})
         SET m.domain             = $domain,
             m.title              = $title,
             m.description        = $description,
             m.yes_prob           = $yes_prob,
             m.no_prob            = $no_prob,
             m.volume_usdc        = $volume_usdc,
             m.resolution_date    = $resolution_date,
             m.url                = $url,
             m.clob_yes_token_id  = $clob_yes_token_id,
             m.clob_no_token_id   = $clob_no_token_id,
             m.neg_risk           = $neg_risk,
             m.fetched_at         = $fetched_at,
             m.embedding          = $embedding`,
        { ...m, group: GROUP, embedding }
      );
    }
  } finally {
    await session.close();
  }
}

export async function closeDriver(): Promise<void> {
  await driver.close();
}
