import "dotenv/config";
import { fetchPredictionMarkets } from "./sources/predictionMarkets.js";
import { fetchNewsRss } from "./sources/newsRss.js";
import { ingestEpisodes } from "./graphiti/client.js";

const INTERVAL_HOURS = parseFloat(process.env.INTERVAL_HOURS ?? "24");
const INTERVAL_MS = INTERVAL_HOURS * 60 * 60 * 1000;

async function tick(): Promise<void> {
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] ---- daily tick starting ----`);

  const [markets, articles] = await Promise.allSettled([
    fetchPredictionMarkets(),
    fetchNewsRss(),
  ]);

  const episodes: string[] = [];

  if (markets.status === "fulfilled") {
    console.log(`  prediction markets: ${markets.value.length} items`);
    episodes.push(...markets.value);
  } else {
    console.error("  prediction markets error:", markets.reason);
  }

  if (articles.status === "fulfilled") {
    console.log(`  news articles: ${articles.value.length} items`);
    episodes.push(...articles.value);
  } else {
    console.error("  news articles error:", articles.reason);
  }

  if (episodes.length > 0) {
    await ingestEpisodes(episodes);
    console.log(`  graphiti: ingested ${episodes.length} episodes`);
  }

  console.log(`[${new Date().toISOString()}] ---- tick done in ${Date.now() - start}ms ----`);
}

async function main(): Promise<void> {
  console.log(
    `[${new Date().toISOString()}] listener starting — interval: ${INTERVAL_HOURS}h`
  );

  await tick();

  setInterval(async () => {
    try {
      await tick();
    } catch (err) {
      console.error("tick error:", err);
    }
  }, INTERVAL_MS);
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
