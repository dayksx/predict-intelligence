import type { IStrategyStore } from "../../ports/outbound/IStrategyStore.js";
import { TradingStrategyZ, type TradingStrategy } from "../../domain/entities/strategy.js";

/**
 * Reads user strategies from the api/ module over HTTP.
 * Used instead of JsonFileStrategyStore when API_URL is set,
 * enabling the ai/ module to be deployed independently of listener/.
 */
export class ApiStrategyStore implements IStrategyStore {
  constructor(private readonly apiUrl: string) {}

  async loadStrategy(ensName: string): Promise<TradingStrategy | null> {
    const label = ensName.replace(/\.agentic\.eth$/, "");
    try {
      const res = await fetch(`${this.apiUrl}/profile/${encodeURIComponent(label)}`);
      if (!res.ok) return null;
      const data = (await res.json()) as { status?: string; profile?: unknown };
      if (data.status !== "registered" || !data.profile) return null;
      return TradingStrategyZ.parse(data.profile);
    } catch (err) {
      console.warn(`[ApiStrategyStore] loadStrategy(${ensName}) failed:`, err);
      return null;
    }
  }

  async listAll(): Promise<TradingStrategy[]> {
    try {
      const res = await fetch(`${this.apiUrl}/profile`);
      if (!res.ok) return [];
      const data = (await res.json()) as { profiles?: unknown[] };
      const results = await Promise.allSettled(
        (data.profiles ?? []).map((p) => TradingStrategyZ.parseAsync(p)),
      );
      return results
        .filter((r): r is PromiseFulfilledResult<TradingStrategy> => r.status === "fulfilled")
        .map((r) => r.value);
    } catch (err) {
      console.warn("[ApiStrategyStore] listAll() failed:", err);
      return [];
    }
  }
}
