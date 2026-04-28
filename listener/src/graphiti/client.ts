import neo4j from "neo4j-driver";
import OpenAI from "openai";
import { config } from "../config.js";
import type { MarketEvent } from "../types.js";

const driver = neo4j.driver(
  config.neo4j.uri,
  neo4j.auth.basic(config.neo4j.user, config.neo4j.password),
);

const openai = new OpenAI({ apiKey: config.openai.apiKey });

/** Creates the Neo4j uniqueness constraint and vector index if they don't exist yet. */
async function ensureIndexes(): Promise<void> {
  const session = driver.session();
  try {
    // Unique constraint for deduplication
    await session.run(
      `CREATE CONSTRAINT market_id_unique IF NOT EXISTS
       FOR (m:Market) REQUIRE (m.market_id, m.group) IS UNIQUE`,
    );
    // Vector index for semantic search (Neo4j 5.x)
    await session.run(
      `CREATE VECTOR INDEX market_embedding IF NOT EXISTS
       FOR (m:Market) ON (m.embedding)
       OPTIONS { indexConfig: { \`vector.dimensions\`: 1536, \`vector.similarity_function\`: 'cosine' } }`,
    );
  } finally {
    await session.close();
  }
}

/** Calls the OpenAI embeddings API in batches to avoid rate limits. */
async function batchEmbed(texts: string[]): Promise<number[][]> {
  const { embeddingModel, embeddingBatchSize } = config.openai;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += embeddingBatchSize) {
    const batch = texts.slice(i, i + embeddingBatchSize);
    const res = await openai.embeddings.create({ model: embeddingModel, input: batch });
    results.push(...res.data.map((d) => d.embedding));
  }

  return results;
}

/** Generates embeddings for all markets and upserts them as Market nodes in Neo4j. */
export async function ingestMarkets(markets: MarketEvent[]): Promise<void> {
  if (!markets.length) return;

  const texts = markets.map((m) => `${m.title} ${m.description}`.trim());
  const embeddings = await batchEmbed(texts);

  const session = driver.session();
  try {
    const tx = session.beginTransaction();

    for (let i = 0; i < markets.length; i++) {
      const m = markets[i]!;
      await tx.run(
        `MERGE (n:Market {market_id: $market_id, group: $group})
         SET n.domain            = $domain,
             n.title             = $title,
             n.description       = $description,
             n.yes_prob          = $yes_prob,
             n.no_prob           = $no_prob,
             n.volume_usdc       = $volume_usdc,
             n.resolution_date   = $resolution_date,
             n.url               = $url,
             n.clob_yes_token_id = $clob_yes_token_id,
             n.clob_no_token_id  = $clob_no_token_id,
             n.neg_risk          = $neg_risk,
             n.fetched_at        = $fetched_at,
             n.embedding         = $embedding`,
        { ...m, group: config.neo4j.group, embedding: embeddings[i] },
      );
    }

    await tx.commit();
  } finally {
    await session.close();
  }
}

/** Runs on startup — sets up Neo4j indexes before any data is written. */
export async function init(): Promise<void> {
  await ensureIndexes();
}

export async function closeDriver(): Promise<void> {
  await driver.close();
}
