/** Normalised market record passed between modules and sent to Graphiti. */
export interface MarketEvent {
  market_id: string;
  domain: string;
  title: string;
  description: string;
  yes_prob: number;
  no_prob: number;
  volume_usdc: number;
  resolution_date: string | null;
  source: "polymarket";
  url: string;
  clob_yes_token_id: string | null;
  clob_no_token_id: string | null;
  neg_risk: boolean;
  related_articles: string[];
  fetched_at: string;
}

/** All recognised market domains; used for category filtering and type safety. */
export const ALL_DOMAINS = ["crypto", "geopolitics", "energy", "sports", "finance", "general"] as const;
export type Domain = (typeof ALL_DOMAINS)[number];
