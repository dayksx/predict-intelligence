import type { UserPrefs } from "../entities/userPrefs.js";
import type { EnrichedPosition } from "../entities/position.js";
import type { MarketFact } from "../entities/market.js";

export function buildSystemPrompt(prefs: UserPrefs): string {
  const domains = prefs.preferred_domains.length
    ? `\n- Preferred domains: ${prefs.preferred_domains.join(", ")}`
    : "";
  return `You are an autonomous prediction market trading agent.

Your role is to analyse the user's open positions and identify new trading opportunities on Polymarket.

## User Preferences
- Take profit at: ${(prefs.take_profit_pct * 100).toFixed(0)}% gain
- Stop loss at: ${(prefs.stop_loss_pct * 100).toFixed(0)}% loss
- Max position size: $${prefs.max_position_usdc} USDC
- Max total exposure: ${(prefs.max_total_exposure_pct * 100).toFixed(0)}% of wallet
- Confidence threshold: ${(prefs.confidence_threshold * 100).toFixed(0)}% minimum${domains}

## Your Task
Return a JSON object with a "decisions" array. For each decision include:
- id: unique string (e.g. "d1", "d2")
- action: one of "trade" | "swap" | "close_position" | "hold_open" | "hold"
- marketId: market identifier (required for trade/close_position, else null)
- positionId: existing position id (required for close_position/hold_open, else null)
- direction: "YES" or "NO" (required for trade, else null)
- sizeUsdc: amount in USDC (required for trade/swap, else null)
- tokenIn / tokenOut: token symbols (required for swap, else null)
- confidence: number 0.0–1.0
- reasoning: concise one-line explanation

## Decision Rules
1. For each open position: decide "close_position" (take profit/stop loss/expired) or "hold_open"
   - Set positionId to the positionId shown, marketId to the marketId shown
2. For new market opportunities: decide "trade" (buy YES/NO) or "hold" (pass)
   - Set marketId to the market_id value from the Market Intelligence section (e.g. "540816")
3. Only recommend new "trade" if confidence >= ${prefs.confidence_threshold}
4. Limit to ${prefs.max_position_usdc} USDC per new position`;
}

export function buildUserMessage(
  openPositions: EnrichedPosition[],
  marketFacts: MarketFact[],
): string {
  const sections: string[] = [];

  if (openPositions.length > 0) {
    const rows = openPositions.map((p) => {
      const price = p.current_price !== null ? ` | price: ${(p.current_price * 100).toFixed(1)}%` : "";
      const pnl =
        p.unrealized_pnl_usdc !== null
          ? ` | PnL: ${p.unrealized_pnl_usdc >= 0 ? "+" : ""}$${p.unrealized_pnl_usdc.toFixed(2)}`
          : "";
      // Show position.id for positionId and market_id for marketId so LLM uses the right values
      return `- positionId:${p.id} marketId:${p.market_id} | ${p.market_question} | ${p.direction} @ $${p.entry_price.toFixed(4)} | $${p.size_usdc}${price}${pnl} | ${p.days_held}d held`;
    });
    sections.push(`## Open Positions\n${rows.join("\n")}`);
  } else {
    sections.push("## Open Positions\nNone.");
  }

  if (marketFacts.length > 0) {
    const rows = marketFacts.map((f) => {
      const when = f.valid_at ? ` [${f.valid_at.slice(0, 10)}]` : "";
      const stale = f.invalid_at ? " ⚠️ outdated" : "";
      return `• ${f.fact}${when}${stale}`;
    });
    sections.push(`## Market Intelligence (from knowledge graph)\n${rows.join("\n")}`);
  } else {
    sections.push("## Market Intelligence\nNo market data in the knowledge graph yet.");
  }

  sections.push("Analyse the above and return your trading decisions as JSON.");
  return sections.join("\n\n");
}
