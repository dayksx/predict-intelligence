import "dotenv/config";
import { config } from "./config.js";
import { fetchPolymarketMarkets } from "./sources/predictionMarkets.js";
import { fetchNewsRss } from "./sources/newsRss.js";
import { init, ingestMarkets } from "./graphiti/client.js";
import { updateRegistry } from "./graphiti/marketRegistry.js";
import { fetchNewSubdomains } from "./ens/subgraphPoller.js";
import { fetchTextRecords } from "./ens/textRecordFetcher.js";
import { buildTradingStrategy } from "./ens/profileBuilder.js";
import { saveProfile, profileExists, readLastPolled, writeLastPolled, readPending, addPending, removePending } from "./ens/profileStore.js";
import { fetchAgentId } from "./apiClient.js";

/** Fetches markets and ingests them into Graphiti + the local market registry. */
async function marketTick(): Promise<void> {
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

/**
 * Polls the ENS Sepolia subgraph for new agentic.eth registrations,
 * fetches text records via viem, and saves per-user TradingStrategy profiles.
 * Also retries any previously discovered names with incomplete metadata.
 */
async function ensTick(): Promise<void> {
  const lastPolled = await readLastPolled();
  const now = Math.floor(Date.now() / 1000);

  // --- Retry pending names (tx1 done, tx2 metadata not yet published) ---
  const pending = await readPending();
  if (pending.length > 0) {
    console.log(`[ens] retrying ${pending.length} pending name(s) with incomplete metadata`);
    for (const ensName of pending) {
      const records = await fetchTextRecords(ensName);
      if (!records) continue; // still not ready
      const agentIdFromApi = await fetchAgentId(ensName);
      const strategy = buildTradingStrategy(ensName, "", records, agentIdFromApi);
      await saveProfile(strategy);
      await removePending(ensName);
      console.log(`[ens] retry succeeded: ${ensName} | focus:${strategy.focusDomain} | agentId:${strategy.agentId}`);
    }
  }

  // --- Discover new subdomains since last poll ---
  console.log(`[ens] polling subgraph for new subdomains since ${lastPolled}`);
  const newDomains = await fetchNewSubdomains(lastPolled);

  if (newDomains.length === 0) {
    console.log("[ens] no new registrations");
    await writeLastPolled(now);
    return;
  }

  console.log(`[ens] ${newDomains.length} new subdomain(s) found`);

  for (const domain of newDomains) {
    if (profileExists(domain.name)) {
      console.log(`[ens] ${domain.name} already registered, skipping`);
      continue;
    }

    const records = await fetchTextRecords(domain.name);
    if (!records) {
      // Metadata not yet published (user completed tx1 but not tx2) — retry next tick
      await addPending(domain.name);
      continue;
    }

    const agentIdFromApi = await fetchAgentId(domain.name);
    const strategy = buildTradingStrategy(domain.name, domain.owner.id, records, agentIdFromApi);
    await saveProfile(strategy);

    console.log(
      `[ens] registered: ${domain.name} | agent:${strategy.agentName} | focus:${strategy.focusDomain} | ${strategy.delegatedAmountEth} ETH delegated`,
    );
  }

  await writeLastPolled(now);
}

async function main(): Promise<void> {
  console.log(`[${new Date().toISOString()}] listener starting — market interval: ${config.intervalHours}h, ENS poll: 1 min`);

  await init();

  // Run both ticks immediately on startup
  await marketTick();
  await ensTick();

  // Market data: once per configured interval (default 24h)
  setInterval(async () => {
    try { await marketTick(); }
    catch (err) { console.error("[market tick error]", err); }
  }, config.intervalHours * 60 * 60 * 1000);

  // ENS registration watch: every 1 minute
  const ENS_POLL_MS = parseInt(process.env.ENS_POLL_INTERVAL_MS ?? "60000");
  setInterval(async () => {
    try { await ensTick(); }
    catch (err) { console.error("[ens tick error]", err); }
  }, ENS_POLL_MS);
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
