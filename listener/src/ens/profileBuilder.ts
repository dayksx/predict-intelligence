import type { EnsTextRecords, FocusDomain, AgentProfileId } from "./types.js";

/** ETH/USD rough estimate for position sizing — update via ETH_USD_ESTIMATE env var. */
const ETH_USD_ESTIMATE = parseFloat(process.env.ETH_USD_ESTIMATE ?? "3000");

/** Hard cap on position size for testing — set MAX_POSITION_USDC=2 to limit all trades to $2. */
const MAX_POSITION_USDC = process.env.MAX_POSITION_USDC
  ? parseFloat(process.env.MAX_POSITION_USDC)
  : null;

/**
 * Base parameters per FocusDomain (search topics, position hold length).
 * These are domain-level defaults, overridden by the agent profile selected in the UI.
 */
const FOCUS_DOMAIN_BASE: Record<
  FocusDomain,
  { graphitiSearchTopics: string[]; max_days_open: number }
> = {
  geopolitic: {
    graphitiSearchTopics: ["geopolitics", "elections", "war", "nato", "sanctions", "conflict"],
    max_days_open: 30,
  },
  crypto: {
    graphitiSearchTopics: ["bitcoin", "ethereum", "crypto", "defi", "token", "blockchain"],
    max_days_open: 14,
  },
  sport: {
    graphitiSearchTopics: ["nba", "nfl", "soccer", "sports", "championship", "football"],
    max_days_open: 7,
  },
};

/**
 * Risk / execution parameters driven by the marketplace agent the user selected.
 *
 * - strategist  → patient, high-confidence, geopolitic focus (slow, careful)
 * - alpha       → aggressive, lower threshold, short holds (crypto / DeFi mindset)
 * - sports      → high volume of smaller bets, tightest risk controls
 */
const AGENT_PROFILE_CONFIG: Record<
  AgentProfileId,
  {
    actions: { prediction_markets: boolean; swap: boolean };
    confidence_threshold: number;
    take_profit_pct: number;
    stop_loss_pct: number;
    position_size_pct: number; // fraction of delegated capital per trade
    max_total_exposure_pct: number;
  }
> = {
  strategist: {
    actions: { prediction_markets: true, swap: false },
    confidence_threshold: 0.70,
    take_profit_pct: 0.35,
    stop_loss_pct: 0.20,
    position_size_pct: 0.10,
    max_total_exposure_pct: 0.60,
  },
  alpha: {
    actions: { prediction_markets: true, swap: true },
    confidence_threshold: 0.55,
    take_profit_pct: 0.45,
    stop_loss_pct: 0.30,
    position_size_pct: 0.15,
    max_total_exposure_pct: 0.80,
  },
  sports: {
    actions: { prediction_markets: true, swap: false },
    confidence_threshold: 0.65,
    take_profit_pct: 0.20,
    stop_loss_pct: 0.15,
    position_size_pct: 0.08,
    max_total_exposure_pct: 0.70,
  },
};

/** Fallback when no agentId is known. */
const _FALLBACK_AGENT_ID: AgentProfileId = "strategist";

/**
 * Enriches the default Graphiti search topics with keywords extracted from the
 * user's free-text thesisPrompt so searches are more targeted.
 */
function enrichTopicsFromThesis(
  baseTopics: string[],
  thesisPrompt: string,
): string[] {
  if (!thesisPrompt) return baseTopics;

  // Extract meaningful tokens (>3 chars, not stopwords) from the thesis prompt
  const stopwords = new Set([
    "that", "this", "with", "from", "will", "have", "been", "they",
    "should", "focus", "want", "want", "only", "always", "never", "about",
  ]);
  const tokens = thesisPrompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 3 && !stopwords.has(t));

  // Deduplicate against base topics
  const existing = new Set(baseTopics.map((t) => t.toLowerCase()));
  const extras = tokens.filter((t) => !existing.has(t)).slice(0, 4);

  return [...baseTopics, ...extras];
}

/**
 * Converts raw ENS text records + on-chain identity into a full TradingStrategy object
 * that the AI module can load and use directly.
 *
 * Parameters are driven by:
 *   1. agentId  (marketplace agent selected in UI) → risk / execution profile
 *   2. focusDomain                                  → search topics & hold length
 *   3. thesisPrompt                                 → enriched search topics
 *   4. delegatedAmountEth                           → position sizing
 */
export function buildTradingStrategy(
  ensName: string,
  walletAddress: string,
  records: EnsTextRecords,
  agentIdFromApi?: string | null,
) {
  const domainBase = FOCUS_DOMAIN_BASE[records.focusDomain];

  // Priority: 1) API (set by UI at registration), 2) reverse-map from ENS agentName, 3) default
  const resolvedAgentId: AgentProfileId =
    (agentIdFromApi as AgentProfileId | null | undefined) ??
    records.agentId ??
    _FALLBACK_AGENT_ID;

  const agentCfg = AGENT_PROFILE_CONFIG[resolvedAgentId] ?? AGENT_PROFILE_CONFIG["strategist"];

  if (!agentIdFromApi && !records.agentId) {
    console.warn(`[profileBuilder] ${ensName}: no agentId from API or ENS — using default strategist config`);
  } else if (agentIdFromApi) {
    console.log(`[profileBuilder] ${ensName}: using agentId "${resolvedAgentId}" from API`);
  }

  const maxPositionUsdc = Math.max(
    Math.min(
      records.delegatedAmountEth * ETH_USD_ESTIMATE * agentCfg.position_size_pct,
      MAX_POSITION_USDC ?? Infinity,
    ),
    1,
  );

  const graphitiSearchTopics = enrichTopicsFromThesis(
    domainBase.graphitiSearchTopics,
    records.thesisPrompt,
  );

  return {
    ensName,
    walletAddress,
    agentName: records.agentName,
    agentId: resolvedAgentId,
    focusDomain: records.focusDomain,
    thesisPrompt: records.thesisPrompt,
    delegatedAmountEth: records.delegatedAmountEth,

    actions: agentCfg.actions,
    graphitiSearchTopics,

    max_position_usdc: maxPositionUsdc,
    max_total_exposure_pct: agentCfg.max_total_exposure_pct,
    gas_reserve_eth: 0.005,

    confidence_threshold: agentCfg.confidence_threshold,
    take_profit_pct: agentCfg.take_profit_pct,
    stop_loss_pct: agentCfg.stop_loss_pct,
    max_days_open: domainBase.max_days_open,

    dry_run: process.env.DRY_RUN !== "false",
    require_human_approval: false,

    registered_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export type TradingStrategyFile = ReturnType<typeof buildTradingStrategy>;
