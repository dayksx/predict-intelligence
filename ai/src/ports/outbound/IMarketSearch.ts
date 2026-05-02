import type { MarketFact } from "../../domain/entities/market.js";

export type { MarketFact };

export interface IMarketSearch {
  search(query: string, maxFacts?: number): Promise<MarketFact[]>;
}
