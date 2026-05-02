import "dotenv/config";
import { fetchNewSubdomains } from "./ens/subgraphPoller.js";
import { fetchTextRecords } from "./ens/textRecordFetcher.js";
import { buildTradingStrategy } from "./ens/profileBuilder.js";
import {
  saveProfile,
  profileExists,
  readLastPolled,
  writeLastPolled,
  readPending,
  addPending,
  removePending,
} from "./ens/profileStore.js";

/**
 * One-shot ENS tick — useful for local testing without the full scheduler.
 * Pass --reset-timestamp to ignore the saved lastPolled and start from epoch 0
 * (re-processes all known agentic.eth subdomains).
 */
async function run(): Promise<void> {
  const resetTimestamp = process.argv.includes("--reset-timestamp");
  const lastPolled = resetTimestamp ? 0 : await readLastPolled();
  const now = Math.floor(Date.now() / 1000);

  if (resetTimestamp) {
    console.log("[ens] --reset-timestamp: polling from epoch 0 (all known subdomains)");
  }

  // --- Retry pending names ---
  const pending = await readPending();
  if (pending.length > 0) {
    console.log(`[ens] retrying ${pending.length} pending name(s) with incomplete metadata`);
    for (const ensName of pending) {
      const records = await fetchTextRecords(ensName);
      if (!records) {
        console.log(`[ens] ${ensName}: metadata still unavailable`);
        continue;
      }
      const strategy = buildTradingStrategy(ensName, "", records);
      await saveProfile(strategy);
      await removePending(ensName);
      console.log(`[ens] retry succeeded: ${ensName} | focus:${strategy.focusDomain}`);
    }
  }

  // --- Discover new subdomains since lastPolled ---
  console.log(`[ens] polling subgraph for new subdomains since ${lastPolled}`);
  const newDomains = await fetchNewSubdomains(lastPolled);

  if (newDomains.length === 0) {
    console.log("[ens] no new registrations found");
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
      await addPending(domain.name);
      console.log(`[ens] ${domain.name}: metadata not ready — queued for retry`);
      continue;
    }

    const strategy = buildTradingStrategy(domain.name, domain.owner.id, records);
    await saveProfile(strategy);

    console.log(
      `[ens] registered: ${domain.name} | agent:${strategy.agentName} | focus:${strategy.focusDomain} | ${strategy.delegatedAmountEth} ETH`,
    );
  }

  await writeLastPolled(now);
  console.log(`[ens] done — lastPolled updated to ${now}`);
}

run().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
