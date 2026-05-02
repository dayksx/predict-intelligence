import { z } from "zod";

export const FocusDomainZ = z.enum(["geopolitic", "crypto", "sport"]);
export type FocusDomain = z.infer<typeof FocusDomainZ>;

/**
 * Static map: focusDomain → capabilities + Graphiti search topics.
 * Must stay in sync with listener/src/ens/profileBuilder.ts FOCUS_DOMAIN_CONFIG.
 */
export const FOCUS_DOMAIN_MAP: Record<
  FocusDomain,
  { actions: { prediction_markets: boolean; swap: boolean }; graphitiSearchTopics: string[] }
> = {
  geopolitic: {
    actions: { prediction_markets: true, swap: false },
    graphitiSearchTopics: ["geopolitics", "elections", "war", "nato", "sanctions", "conflict"],
  },
  crypto: {
    actions: { prediction_markets: true, swap: true },
    graphitiSearchTopics: ["bitcoin", "ethereum", "crypto", "defi", "token", "blockchain"],
  },
  sport: {
    actions: { prediction_markets: true, swap: false },
    graphitiSearchTopics: ["nba", "nfl", "soccer", "sports", "championship", "football"],
  },
};

/**
 * Full per-user trading strategy derived from ENS metadata.
 * Written by the listener (profileBuilder) and read by the AI module.
 */
export const TradingStrategyZ = z.object({
  // ENS identity
  ensName: z.string(),
  walletAddress: z.string(),
  agentName: z.string(),
  focusDomain: FocusDomainZ,
  thesisPrompt: z.string(),
  delegatedAmountEth: z.number(),

  // Derived capabilities (set by profileBuilder from focusDomain)
  actions: z.object({ prediction_markets: z.boolean(), swap: z.boolean() }),
  graphitiSearchTopics: z.array(z.string()),

  // Position sizing
  max_position_usdc: z.number().default(25),
  max_total_exposure_pct: z.number().default(0.7),
  gas_reserve_eth: z.number().default(0.005),

  // Trading behaviour
  confidence_threshold: z.number().default(0.65),
  take_profit_pct: z.number().default(0.3),
  stop_loss_pct: z.number().default(0.2),
  max_days_open: z.number().default(30),
  dry_run: z.boolean().default(true),
  require_human_approval: z.boolean().default(false),

  // Metadata
  registered_at: z.string(),
  updated_at: z.string(),
});

export type TradingStrategy = z.infer<typeof TradingStrategyZ>;
