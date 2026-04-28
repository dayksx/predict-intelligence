import "dotenv/config";
import { config } from "./config.js";
import { fetchPolymarketMarkets } from "./sources/predictionMarkets.js";
import { fetchNewsRss } from "./sources/newsRss.js";
import { init, ingestMarkets, closeDriver } from "./graphiti/client.js";

async function tick(): Promise<void> {
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] ---- tick starting ----`);

  const markets = await fetchPolymarketMarkets();
  await ingestMarkets(markets);

  const byDomain = markets.reduce<Record<string, number>>((acc, m) => {
    acc[m.domain] = (acc[m.domain] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`[Neo4j] upserted ${markets.length} markets`, byDomain);

  const articles = await fetchNewsRss();
  console.log(`[RSS] ${articles.length} articles fetched`);

  console.log(`[${new Date().toISOString()}] ---- done in ${Date.now() - start}ms ----`);
}

async function main(): Promise<void> {
  console.log(`[${new Date().toISOString()}] listener starting — interval: ${config.intervalHours}h`);

  await init();
  await tick();

  setInterval(async () => {
    try {
      await tick();
    } catch (err) {
      console.error("tick error:", err);
    }
  }, config.intervalHours * 60 * 60 * 1000);
}

main().catch(async (err) => {
  console.error("fatal:", err);
  await closeDriver();
  process.exit(1);
});
