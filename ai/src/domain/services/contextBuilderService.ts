import type { TradingStrategy } from "../entities/strategy.js";
import type { EnrichedPosition } from "../entities/position.js";
import type { MarketFact } from "../entities/market.js";

/** Builds the system prompt injected into the LLM, personalised per user's ENS strategy. */
export function buildSystemPrompt(strategy: TradingStrategy): string {
  const swapNote = strategy.actions.swap
    ? "\n- Swaps: enabled — use swap action to buy/sell tokens on Uniswap (Sepolia testnet) when crypto market signals are strong"
    : "\n- Swaps: disabled for this profile";

  const swapRules = strategy.actions.swap
    ? `\n5. **Uniswap swaps** (crypto signals only): when a prediction market shows >65% probability for a crypto outcome (e.g. ETH price up, BTC rally, DeFi protocol growth), ALSO emit a "swap" decision alongside or instead of the market trade:
   - tokenIn: "USDC" (sell stablecoin), tokenOut: the relevant token (e.g. "WETH", "UNI")
   - sizeUsdc: same sizing rules as a trade (max $${strategy.max_position_usdc.toFixed(2)})
   - confidence: derived from the prediction market probability
   - Only swap when confidence >= ${strategy.confidence_threshold} and focusDomain is crypto`
    : "";

  const thesisSection = strategy.thesisPrompt
    ? `\n## Your Investment Thesis\n${strategy.thesisPrompt}`
    : "";

  return `You are an autonomous prediction market trading agent.

## Agent Profile
${strategy.agentName} — ${strategy.focusDomain} markets
Wallet: ${strategy.walletAddress || "not set"}${thesisSection}

## Focus Topics
${strategy.graphitiSearchTopics.join(", ")}

## Trading Parameters
- Take profit at: ${(strategy.take_profit_pct * 100).toFixed(0)}% gain
- Stop loss at: ${(strategy.stop_loss_pct * 100).toFixed(0)}% loss
- Max position size: $${strategy.max_position_usdc.toFixed(2)} USDC
- Max total exposure: ${(strategy.max_total_exposure_pct * 100).toFixed(0)}% of wallet
- Confidence threshold: ${(strategy.confidence_threshold * 100).toFixed(0)}% minimum
- Max days open: ${strategy.max_days_open}
- Prediction markets: enabled${swapNote}

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
2. For new market opportunities aligned with your thesis: decide "trade" (buy YES/NO) or "hold" (pass)
   - Set marketId to the market_id value from the Market Intelligence section (e.g. "540816")
3. Only recommend new "trade" if confidence >= ${strategy.confidence_threshold}
4. Limit to $${strategy.max_position_usdc.toFixed(2)} USDC per new position${swapRules}`;
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
