import type { ITradeExecutor } from "../../ports/outbound/ITradeExecutor.js";
import type { ISwapExecutor } from "../../ports/outbound/ISwapExecutor.js";
import type { IAuditLogger } from "../../ports/outbound/IAuditLogger.js";
import type { IMarketRegistry } from "../../ports/outbound/IMarketRegistry.js";
import type { AgentState } from "../agentState.js";
import type { ToolResult } from "../../domain/entities/decision.js";

/** Deterministically dispatches each validated decision to the appropriate executor.
 *  CLOB token IDs are resolved from the market registry (authoritative) before execution —
 *  the LLM-provided values are only used as a fallback if the market is not in the registry. */
export function makeActNode(
  tradeExecutor: ITradeExecutor,
  swapExecutor: ISwapExecutor,
  auditLogger: IAuditLogger,
  marketRegistry: IMarketRegistry,
  walletAddress: string,
) {
  return async function actNode(state: AgentState): Promise<Partial<AgentState>> {
    const prefs = state.userPrefs!;
    const results: ToolResult[] = [];

    for (const decision of state.validatedDecisions) {
      try {
        let result: ToolResult;

        if (decision.action === "trade" || decision.action === "close_position") {
          // Registry lookup — exact by numeric ID first, then title fuzzy match.
          // The LLM sometimes writes the question text instead of the numeric market_id.
          const registryEntry = decision.marketId
            ? (await marketRegistry.lookup(decision.marketId)) ??
              (await marketRegistry.lookupByTitle(decision.marketId))
            : null;

          if (!registryEntry) {
            console.warn(`[act] market "${decision.marketId}" not found in registry — using LLM-provided CLOB values`);
          } else if (registryEntry.market_id !== decision.marketId) {
            console.log(`[act] title match: "${decision.marketId}" → registry id ${registryEntry.market_id}`);
          }

          const direction = (decision.direction?.toLowerCase() ?? "yes") as "yes" | "no";
          const clobTokenId = direction === "yes"
            ? (registryEntry?.clob_yes_token_id ?? decision.clobTokenId ?? undefined)
            : (registryEntry?.clob_no_token_id  ?? decision.clobTokenId ?? undefined);

          result = await tradeExecutor.executeTrade(
            {
              market_id:     registryEntry?.market_id ?? decision.marketId!,
              clob_token_id: clobTokenId,
              neg_risk:      registryEntry?.neg_risk ?? decision.negRisk ?? false,
              yes_price:     decision.yesPrice ?? undefined,
              no_price:      decision.noPrice ?? undefined,
              action:        "trade",
              direction,
              amount_usdc:   decision.sizeUsdc ?? prefs.max_position_usdc,
              confidence:    decision.confidence,
              rationale:     decision.reasoning,
              sources:       decision.sources ?? [],
            },
            {
              walletAddress,
              dryRun: prefs.dry_run,
              sell:   decision.sell ?? decision.action === "close_position",
            },
          );
        } else if (decision.action === "swap") {
          const swapResult = await swapExecutor.executeSwap({
            tokenIn:  decision.tokenIn  ?? "USDC",
            tokenOut: decision.tokenOut ?? "WETH",
            amountIn: decision.sizeUsdc ?? prefs.max_position_usdc,
            dryRun:   prefs.dry_run,
          });
          result = { ...swapResult, dryRun: prefs.dry_run };
        } else {
          result = { success: true, dryRun: prefs.dry_run };
        }

        result = { ...result, decisionId: decision.id, action: decision.action };

        await auditLogger.writeLog({
          timestamp: new Date().toISOString(),
          runId: state.runId,
          event: "action_executed",
          data: { decision, result },
        });
        results.push(result);
      } catch (err) {
        results.push({
          success: false,
          error: String(err),
          dryRun: prefs.dry_run,
          decisionId: decision.id,
          action: decision.action,
        });
      }
    }

    return { executionResults: results };
  };
}
