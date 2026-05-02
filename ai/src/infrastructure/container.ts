import { resolve, join } from "path";
import { GraphitiAdapter } from "../adapters/outbound/GraphitiAdapter.js";
import { JsonFileStrategyStore } from "../adapters/outbound/JsonFileStrategyStore.js";
import { ApiStrategyStore } from "../adapters/outbound/ApiStrategyStore.js";
import { JsonFilePositionStore } from "../adapters/outbound/JsonFilePositionStore.js";
import { JsonFileMarketRegistry } from "../adapters/outbound/JsonFileMarketRegistry.js";
import { FileAuditLogger } from "../adapters/outbound/FileAuditLogger.js";
import { ApiPositionStore } from "../adapters/outbound/ApiPositionStore.js";
import { ApiAuditLogger } from "../adapters/outbound/ApiAuditLogger.js";
import { StubWalletService } from "../adapters/outbound/StubWalletService.js";
import { StubTradeExecutor } from "../adapters/outbound/StubTradeExecutor.js";
import { StubSwapExecutor } from "../adapters/outbound/StubSwapExecutor.js";
import { UniswapSwapExecutor } from "../adapters/outbound/UniswapSwapExecutor.js";
import { createWorkflow } from "../application/graph.js";
import { WorkflowRunner } from "../adapters/inbound/WorkflowRunner.js";
import { createA2AServer } from "../adapters/inbound/a2a.js";
import { runDailyCycle } from "./scheduler.js";
import type { TradingStrategy } from "../domain/entities/strategy.js";
// container.ts is the only file allowed to import across all layers

export interface Container {
  /** Express application for the A2A inbound server. */
  app: ReturnType<typeof createA2AServer>;
  /** Trigger a full daily cycle manually (also used by the scheduler interval). */
  runDailyCycle: () => Promise<void>;
}

/**
 * Wires all adapters, assembles the workflow, and returns the ready-to-use container.
 * When API_URL is set, positions and audit logs are also pushed to the api/ module
 * (dual-write: local file + api) so each module can be deployed independently.
 */
export function buildContainer(): Container {
  const profilesDir  = process.env.PROFILES_DIR         ?? resolve("data/profiles");
  const positionsDir = process.env.POSITIONS_DIR         ?? resolve("data/positions");
  const auditDir     = process.env.AUDIT_DIR             ?? resolve("data/audit");
  const registryFile = process.env.MARKET_REGISTRY_FILE  ?? resolve("data/market_registry.json");
  const apiUrl       = process.env.API_URL?.replace(/\/$/, "");

  // Use ApiStrategyStore when API_URL is set (independent deployment);
  // fall back to reading JSON files from disk when running standalone.
  const strategyStore = apiUrl
    ? new ApiStrategyStore(apiUrl)
    : new JsonFileStrategyStore(profilesDir);

  if (apiUrl) {
    console.log(`[container] strategy store → API (${apiUrl})`);
  } else {
    console.log(`[container] strategy store → local files (${profilesDir})`);
  }
  const marketSearch   = new GraphitiAdapter();
  const marketRegistry = new JsonFileMarketRegistry(registryFile);
  const walletService  = new StubWalletService();
  const tradeExecutor  = new StubTradeExecutor();

  // Use the real Uniswap Trading API when UNISWAP_API_KEY is configured;
  // fall back to the stub so the rest of the workflow is never blocked.
  const swapExecutor = process.env.UNISWAP_API_KEY
    ? new UniswapSwapExecutor()
    : new StubSwapExecutor();

  if (process.env.UNISWAP_API_KEY) {
    console.log("[container] swap executor → Uniswap Trading API (Sepolia)");
  } else {
    console.log("[container] swap executor → stub (set UNISWAP_API_KEY to enable real swaps)");
  }

  /** Per-user workflow factory — mirrors scheduler logic so A2A runs also write to the API. */
  const workflowFactory = (strategy: TradingStrategy) => {
    const filePositionStore = new JsonFilePositionStore(
      join(positionsDir, `${strategy.ensName}.json`),
    );
    const fileAuditLogger = new FileAuditLogger(
      join(auditDir, `${strategy.ensName}.jsonl`),
    );
    const positionStore = apiUrl
      ? new ApiPositionStore(apiUrl, strategy.ensName, filePositionStore)
      : filePositionStore;
    const auditLogger = apiUrl
      ? new ApiAuditLogger(apiUrl, strategy.ensName, fileAuditLogger)
      : fileAuditLogger;

    return createWorkflow({
      marketSearch,
      positionStore,
      auditLogger,
      marketRegistry,
      walletService,
      tradeExecutor,
      swapExecutor,
    });
  };

  const runner = new WorkflowRunner(workflowFactory, strategyStore);
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
      apiUrl,
    });

  return { app, runDailyCycle: dailyCycle };
}
