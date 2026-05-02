import type { EnsTextRecords, FocusDomain } from "./types.js";

/** ETH/USD rough estimate for position sizing — update via ETH_USD_ESTIMATE env var. */
const ETH_USD_ESTIMATE = parseFloat(process.env.ETH_USD_ESTIMATE ?? "3000");

/** Each focus domain maps to a fixed set of capabilities and Graphiti search topics.
 *  Must stay in sync with ai/src/domain/entities/strategy.ts FOCUS_DOMAIN_MAP. */
const FOCUS_DOMAIN_CONFIG: Record<
  FocusDomain,
  {
    actions: { prediction_markets: boolean; swap: boolean };
    graphitiSearchTopics: string[];
    confidence_threshold: number;
    take_profit_pct: number;
    stop_loss_pct: number;
    max_days_open: number;
  }
> = {
  geopolitic: {
    actions: { prediction_markets: true, swap: false },
    graphitiSearchTopics: ["geopolitics", "elections", "war", "nato", "sanctions", "conflict"],
    confidence_threshold: 0.65,
    take_profit_pct: 0.30,
    stop_loss_pct: 0.20,
    max_days_open: 30,
  },
  crypto: {
    actions: { prediction_markets: true, swap: true },
    graphitiSearchTopics: ["bitcoin", "ethereum", "crypto", "defi", "token", "blockchain"],
    confidence_threshold: 0.60,
    take_profit_pct: 0.40,
    stop_loss_pct: 0.25,
    max_days_open: 14,
  },
  sport: {
    actions: { prediction_markets: true, swap: false },
    graphitiSearchTopics: ["nba", "nfl", "soccer", "sports", "championship", "football"],
    confidence_threshold: 0.70,
    take_profit_pct: 0.25,
    stop_loss_pct: 0.15,
    max_days_open: 7,
  },
};

/**
 * Converts raw ENS text records + on-chain identity into a full TradingStrategy object
 * that the AI module can load and use directly.
 */
export function buildTradingStrategy(
  ensName: string,
  walletAddress: string,
  records: EnsTextRecords,
) {
  const domainCfg = FOCUS_DOMAIN_CONFIG[records.focusDomain];

  // 10% of delegated capital per position, minimum $1
  const maxPositionUsdc = Math.max(records.delegatedAmountEth * ETH_USD_ESTIMATE * 0.1, 1);

  return {
    ensName,
    walletAddress,
    agentName: records.agentName,
    focusDomain: records.focusDomain,
    thesisPrompt: records.thesisPrompt,
    delegatedAmountEth: records.delegatedAmountEth,

    actions: domainCfg.actions,
    graphitiSearchTopics: domainCfg.graphitiSearchTopics,

    max_position_usdc: maxPositionUsdc,
    max_total_exposure_pct: 0.7,
    gas_reserve_eth: 0.005,

    confidence_threshold: domainCfg.confidence_threshold,
    take_profit_pct: domainCfg.take_profit_pct,
    stop_loss_pct: domainCfg.stop_loss_pct,
    max_days_open: domainCfg.max_days_open,

    dry_run: process.env.DRY_RUN !== "false",
    require_human_approval: false,

    registered_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export type TradingStrategyFile = ReturnType<typeof buildTradingStrategy>;
