import "dotenv/config";
import { fetchPredictionMarkets } from "./sources/predictionMarkets.js";
import { fetchNewsRss } from "./sources/newsRss.js";
import { ingestMarkets, closeDriver } from "./graphiti/client.js";

const INTERVAL_HOURS = parseFloat(process.env.INTERVAL_HOURS ?? "24");
const INTERVAL_MS = INTERVAL_HOURS * 60 * 60 * 1000;

async function tick(): Promise<void> {
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] ---- tick starting ----`);

  const markets = await fetchPredictionMarkets();
  const byDomain = markets.reduce<Record<string, number>>((acc, m) => {
    acc[m.domain] = (acc[m.domain] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`  polymarket: ${markets.length} markets`, byDomain);

  await ingestMarkets(markets);
  console.log(`  neo4j: upserted ${markets.length} Market nodes`);

  const articles = await fetchNewsRss();
  console.log(`  news rss: ${articles.length} articles`);

  console.log(`[${new Date().toISOString()}] ---- done in ${Date.now() - start}ms ----`);
}

async function main(): Promise<void> {
  console.log(`[${new Date().toISOString()}] listener starting — interval: ${INTERVAL_HOURS}h`);

  await tick();

  setInterval(async () => {
    try {
      await tick();
    } catch (err) {
      console.error("tick error:", err);
    }
  }, INTERVAL_MS);
}

main().catch(async (err) => {
  console.error("fatal:", err);
  await closeDriver();
  process.exit(1);
});
