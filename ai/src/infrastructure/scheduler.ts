import { HumanMessage } from "@langchain/core/messages";
import { join } from "path";
import type { IStrategyStore } from "../ports/outbound/IStrategyStore.js";
import type { IMarketSearch } from "../ports/outbound/IMarketSearch.js";
import type { ITradeExecutor } from "../ports/outbound/ITradeExecutor.js";
import type { ISwapExecutor } from "../ports/outbound/ISwapExecutor.js";
import type { IWalletService } from "../ports/outbound/IWalletService.js";
import type { IMarketRegistry } from "../ports/outbound/IMarketRegistry.js";
import { JsonFilePositionStore } from "../adapters/outbound/JsonFilePositionStore.js";
import { FileAuditLogger } from "../adapters/outbound/FileAuditLogger.js";
import { createWorkflow } from "../application/graph.js";

interface SharedDeps {
  strategyStore: IStrategyStore;
  marketSearch: IMarketSearch;
  tradeExecutor: ITradeExecutor;
  swapExecutor: ISwapExecutor;
  walletService: IWalletService;
  marketRegistry: IMarketRegistry;
  positionsDir: string;
  auditDir: string;
}

/**
 * Runs the full LangGraph pipeline once for every registered user.
 * Each user gets isolated position and audit log files.
 * Called once per day by the scheduler loop in main.ts.
 */
export async function runDailyCycle(deps: SharedDeps): Promise<void> {
  const strategies = await deps.strategyStore.listAll();

  if (strategies.length === 0) {
    console.log("[scheduler] no user profiles found — skipping daily cycle");
    return;
  }

  console.log(`[scheduler] daily cycle starting for ${strategies.length} user(s)`);

  for (const strategy of strategies) {
    console.log(`[scheduler] ── running: ${strategy.ensName} (${strategy.agentName})`);

    try {
      // Per-user position store and audit logger — isolated files per ENS name
      const positionStore = new JsonFilePositionStore(
        join(deps.positionsDir, `${strategy.ensName}.json`),
      );
      const auditLogger = new FileAuditLogger(
        join(deps.auditDir, `${strategy.ensName}.jsonl`),
      );

      const workflow = createWorkflow({
        marketSearch: deps.marketSearch,
        positionStore,
        auditLogger,
        tradeExecutor: deps.tradeExecutor,
        swapExecutor: deps.swapExecutor,
        walletService: deps.walletService,
        marketRegistry: deps.marketRegistry,
      });

      const result = await workflow.invoke(
        {
          messages: [new HumanMessage("Run daily market analysis and make trading decisions.")],
          strategy,
        },
        { configurable: { thread_id: strategy.ensName } },
      );

      console.log(`[scheduler] ── done: ${strategy.ensName} | ${result.summary ?? "no summary"}`);
    } catch (err) {
      console.error(`[scheduler] ── error for ${strategy.ensName}:`, err);
    }
  }

  console.log("[scheduler] daily cycle complete");
}
