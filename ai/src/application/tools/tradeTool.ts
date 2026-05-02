/**
 * LangChain tool: prediction market trade on Polymarket CLOB.
 *
 * The agent wallet address is fixed infrastructure — closed over from the
 * factory parameter, never exposed in the Zod schema.
 *
 * clob_token_id: the actual Polymarket CLOB token ID for the outcome being traded.
 * This is different from the Gamma market_id. actNode looks it up from
 * MarketEvent.clob_yes_token_id / clob_no_token_id and passes it here.
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { ITradeExecutor } from "../../ports/outbound/ITradeExecutor.js";
import type { ToolResult } from "../../domain/entities/decision.js";

const TradeInputSchema = z.object({
  market_id:     z.string().describe("Gamma market ID (used for logging)"),
  clob_token_id: z.string().optional().describe("Polymarket CLOB token ID for the specific outcome. Required for live trades."),
  neg_risk:      z.boolean().optional().default(false).describe("true if the market uses the NegRiskAdapter contract"),
  yes_price:     z.number().optional().describe("Current YES token price (probability). Used as limit price for YES buys."),
  no_price:      z.number().optional().describe("Current NO token price (probability). Used as limit price for NO buys."),
  direction:     z.enum(["yes", "no"]).describe("Which outcome token to buy: yes or no"),
  sell:          z.boolean().optional().default(false).describe("true = close position by selling owned tokens back (SELL order). Default false = open position (BUY order)."),
  amount_usdc:   z.number().positive().describe("Position size in USDC"),
  dry_run:       z.boolean().default(false).describe("Simulate without posting order if true"),
});

export type TradeInput = z.infer<typeof TradeInputSchema>;

export function makeTradeTool(executor: ITradeExecutor, agentWalletAddress: string) {
  return tool(
    async (input: TradeInput): Promise<ToolResult> => {
      return executor.executeTrade(
        {
          market_id:     input.market_id,
          clob_token_id: input.clob_token_id,
          neg_risk:      input.neg_risk ?? false,
          yes_price:     input.yes_price,
          no_price:      input.no_price,
          action:        "trade",
          direction:     input.direction,
          amount_usdc:   input.amount_usdc,
          confidence:    1,
          rationale:     "",
          sources:       [],
        },
        { walletAddress: agentWalletAddress, dryRun: input.dry_run, sell: input.sell ?? false },
      );
    },
    {
      name: "polymarket_trade",
      description:
        "Buy or sell outcome tokens on Polymarket CLOB using the agent wallet. " +
        "Use when the decision action is 'trade'. " +
        "direction='yes' buys YES shares; direction='no' buys NO shares.",
      schema: TradeInputSchema,
    },
  );
}
