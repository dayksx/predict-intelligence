import { resolve } from "path";
import { GraphitiAdapter } from "../adapters/outbound/GraphitiAdapter.js";
import { JsonFileStrategyStore } from "../adapters/outbound/JsonFileStrategyStore.js";
import { JsonFilePositionStore } from "../adapters/outbound/JsonFilePositionStore.js";
import { JsonFileMarketRegistry } from "../adapters/outbound/JsonFileMarketRegistry.js";
import { FileAuditLogger } from "../adapters/outbound/FileAuditLogger.js";
import { StubWalletService } from "../adapters/outbound/StubWalletService.js";
import { StubTradeExecutor } from "../adapters/outbound/StubTradeExecutor.js";
import { StubSwapExecutor } from "../adapters/outbound/StubSwapExecutor.js";
import { createWorkflow } from "../application/graph.js";
import { WorkflowRunner } from "../adapters/inbound/WorkflowRunner.js";
import { createA2AServer } from "../adapters/inbound/a2a.js";
import { runDailyCycle } from "./scheduler.js";
// container.ts is the only file allowed to import across all layers

export interface Container {
  /** Express application for the A2A inbound server. */
  app: ReturnType<typeof createA2AServer>;
  /** Trigger a full daily cycle manually (also used by the scheduler interval). */
  runDailyCycle: () => Promise<void>;
}

/**
 * Wires all adapters, assembles the workflow, and returns the ready-to-use container.
 * Per-user isolation for the A2A path: WorkflowRunner creates per-user file paths.
 * Per-user isolation for the scheduler path: runDailyCycle() creates per-user instances.
 */
export function buildContainer(): Container {
  const profilesDir    = process.env.PROFILES_DIR         ?? resolve("data/profiles");
  const positionsDir   = process.env.POSITIONS_DIR         ?? resolve("data/positions");
  const auditDir       = process.env.AUDIT_DIR             ?? resolve("data/audit");
  const registryFile   = process.env.MARKET_REGISTRY_FILE  ?? resolve("data/market_registry.json");

  const strategyStore  = new JsonFileStrategyStore(profilesDir);
  const marketSearch   = new GraphitiAdapter();
  const marketRegistry = new JsonFileMarketRegistry(registryFile);
  const walletService  = new StubWalletService();
  const tradeExecutor  = new StubTradeExecutor();
  const swapExecutor   = new StubSwapExecutor();

  // A2A path: single shared workflow + per-request strategy loaded by WorkflowRunner
  // Position store and audit logger for A2A use the ensName-keyed files too —
  // WorkflowRunner.run() loads strategy first, then per-user deps are created below
  const a2aPositionStore = new JsonFilePositionStore(resolve("data/positions/default.json"));
  const a2aAuditLogger   = new FileAuditLogger(resolve("data/audit/default.jsonl"));

  const workflow = createWorkflow({
    marketSearch,
    positionStore:  a2aPositionStore,
    auditLogger:    a2aAuditLogger,
    marketRegistry,
    walletService,
    tradeExecutor,
    swapExecutor,
  });

  const runner = new WorkflowRunner(workflow, strategyStore);
  const app    = createA2AServer(runner);

  const dailyCycle = () =>
    runDailyCycle({
      strategyStore,
      marketSearch,
      marketRegistry,
      walletService,
      tradeExecutor,
      swapExecutor,
      positionsDir,
      auditDir,
    });

  return { app, runDailyCycle: dailyCycle };
}
