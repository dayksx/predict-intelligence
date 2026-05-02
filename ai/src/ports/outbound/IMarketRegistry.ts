export interface MarketRegistryEntry {
  market_id: string;
  title: string;
  clob_yes_token_id: string | null;
  clob_no_token_id: string | null;
  neg_risk: boolean;
  resolution_date: string | null;
  domain: string;
  updated_at: string;
}

/** Outbound port — exact key-value lookup of Polymarket trading metadata by market_id.
 *  Intentionally separate from IMarketSearch: Graphiti is for reasoning, this is for execution. */
export interface IMarketRegistry {
  lookup(marketId: string): Promise<MarketRegistryEntry | null>;
  /** Fallback: finds the best title match when the LLM returns a question string instead of an ID. */
  lookupByTitle(title: string): Promise<MarketRegistryEntry | null>;
}
