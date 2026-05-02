import "dotenv/config";
import { init } from "./graphiti/client.js";
import { fetchPolymarketMarkets } from "./sources/predictionMarkets.js";
import { fetchNewsRss } from "./sources/newsRss.js";
import { ingestMarkets } from "./graphiti/client.js";
import { updateRegistry } from "./graphiti/marketRegistry.js";

/** One-shot market tick — useful for local testing without the full scheduler. */
async function run(): Promise<void> {
  await init();

  const start = Date.now();
  console.log(`[${new Date().toISOString()}] ---- market tick starting ----`);

  const markets = await fetchPolymarketMarkets();
  await updateRegistry(markets);
  await ingestMarkets(markets);

  const byDomain = markets.reduce<Record<string, number>>((acc, m) => {
    acc[m.domain] = (acc[m.domain] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`[Polymarket] queued ${markets.length} episodes for Graphiti processing`, byDomain);

  const articles = await fetchNewsRss();
  console.log(`[RSS] ${articles.length} articles fetched`);

  console.log(`[${new Date().toISOString()}] ---- done in ${Date.now() - start}ms ----`);
}

run().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
