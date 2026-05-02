import { readFile, readdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { TradingStrategyZ, type TradingStrategy } from "../../domain/entities/strategy.js";
import type { IStrategyStore } from "../../ports/outbound/IStrategyStore.js";

export class JsonFileStrategyStore implements IStrategyStore {
  constructor(private readonly profilesDir: string) {}

  async loadStrategy(ensName: string): Promise<TradingStrategy | null> {
    const filePath = join(this.profilesDir, `${ensName}.json`);
    if (!existsSync(filePath)) return null;
    const raw = await readFile(filePath, "utf-8");
    return TradingStrategyZ.parse(JSON.parse(raw));
  }

  async listAll(): Promise<TradingStrategy[]> {
    if (!existsSync(this.profilesDir)) return [];
    const files = await readdir(this.profilesDir);
    const results = await Promise.allSettled(
      files
        .filter((f) => f.endsWith(".json"))
        .map(async (f) => {
          const raw = await readFile(join(this.profilesDir, f), "utf-8");
          return TradingStrategyZ.parse(JSON.parse(raw));
        }),
    );
    return results
      .filter((r): r is PromiseFulfilledResult<TradingStrategy> => r.status === "fulfilled")
      .map((r) => r.value);
  }
}
