import type { ToolResult } from "../../domain/entities/decision.js";

export interface TradeParams {
  market_id: string;
  clob_token_id?: string;
  neg_risk: boolean;
  yes_price?: number;
  no_price?: number;
  action: "trade";
  direction: "yes" | "no";
  amount_usdc: number;
  confidence: number;
  rationale: string;
  sources: string[];
}

export interface ExecutorOptions {
  walletAddress: string;
  dryRun: boolean;
  sell: boolean;
}

export interface ITradeExecutor {
  executeTrade(params: TradeParams, options: ExecutorOptions): Promise<ToolResult>;
}
