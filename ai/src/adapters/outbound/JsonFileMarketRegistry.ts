import { readFile } from "fs/promises";
import { existsSync } from "fs";
import type { IMarketRegistry, MarketRegistryEntry } from "../../ports/outbound/IMarketRegistry.js";

type RegistryFile = Record<string, MarketRegistryEntry>;

/** Outbound adapter — reads the market registry JSON written by the listener.
 *  Provides exact CLOB token ID and neg_risk lookup by market_id, with no LLM involvement.
 *  Also supports fuzzy title matching for when the LLM returns a question string as the marketId. */
export class JsonFileMarketRegistry implements IMarketRegistry {
  private cache: RegistryFile | null = null;
  private cacheLoadedAt = 0;
  private readonly TTL_MS = 5 * 60 * 1000;

  constructor(private readonly filePath: string) {}

  async lookup(marketId: string): Promise<MarketRegistryEntry | null> {
    const registry = await this.getRegistry();
    return registry[marketId] ?? null;
  }

  async lookupByTitle(title: string): Promise<MarketRegistryEntry | null> {
    const registry = await this.getRegistry();
    const needle = title.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();

    let bestEntry: MarketRegistryEntry | null = null;
    let bestScore = 0;

    for (const entry of Object.values(registry)) {
      const haystack = entry.title.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
      const score = wordOverlapScore(needle, haystack);
      if (score > bestScore) {
        bestScore = score;
        bestEntry = entry;
      }
    }

    // Require at least 50% word overlap to avoid false matches
    return bestScore >= 0.5 ? bestEntry : null;
  }

  private async getRegistry(): Promise<RegistryFile> {
    const now = Date.now();
    if (this.cache && now - this.cacheLoadedAt < this.TTL_MS) return this.cache;
    if (!existsSync(this.filePath)) {
      console.warn(`[registry] file not found at ${this.filePath} — CLOB lookups will fall back to LLM values`);
      return {};
    }
    this.cache = JSON.parse(await readFile(this.filePath, "utf-8")) as RegistryFile;
    this.cacheLoadedAt = now;
    return this.cache;
  }
}

/** Jaccard-like word overlap: intersection / union of word sets. */
function wordOverlapScore(a: string, b: string): number {
  const setA = new Set(a.split(" ").filter(Boolean));
  const setB = new Set(b.split(" ").filter(Boolean));
  const intersection = [...setA].filter((w) => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}
