/** Outbound port — defines how the agent fetches market facts from external storage. */

export interface MarketFact {
  uuid: string;
  name: string;
  fact: string;
  valid_at: string | null;
  invalid_at: string | null;
}

export interface IMarketSearch {
  search(query: string, maxFacts?: number): Promise<MarketFact[]>;
}
