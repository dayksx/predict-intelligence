import type { ITradeExecutor, TradeParams, ExecutorOptions } from "../../ports/outbound/ITradeExecutor.js";
import type { ToolResult } from "../../domain/entities/decision.js";

/** Stub — logs trade intent without executing. Replace with PolymarketTradeExecutor for production. */
export class StubTradeExecutor implements ITradeExecutor {
  async executeTrade(params: TradeParams, options: ExecutorOptions): Promise<ToolResult> {
    const label = options.dryRun ? "[dry-run]" : "[LIVE]";
    const side = options.sell ? "SELL" : "BUY";
    console.log(
      `${label} ${side} ${params.direction.toUpperCase()} $${params.amount_usdc} USDC` +
      ` | market: ${params.market_id}` +
      (params.clob_token_id ? ` | clob: ${params.clob_token_id}` : "") +
      (params.neg_risk ? " | neg-risk" : ""),
    );
    return { success: true, dryRun: options.dryRun };
  }
}
