import { resolve } from "path";
import { GraphitiAdapter } from "../adapters/outbound/GraphitiAdapter.js";
import { JsonFileUserPrefsRepo } from "../adapters/outbound/JsonFileUserPrefsRepo.js";
import { JsonFilePositionStore } from "../adapters/outbound/JsonFilePositionStore.js";
import { JsonFileMarketRegistry } from "../adapters/outbound/JsonFileMarketRegistry.js";
import { FileAuditLogger } from "../adapters/outbound/FileAuditLogger.js";
import { StubWalletService } from "../adapters/outbound/StubWalletService.js";
import { StubTradeExecutor } from "../adapters/outbound/StubTradeExecutor.js";
import { StubSwapExecutor } from "../adapters/outbound/StubSwapExecutor.js";
import { createWorkflow } from "../application/graph.js";
import { WorkflowRunner } from "../adapters/inbound/WorkflowRunner.js";
import { createA2AServer } from "../adapters/inbound/a2a.js";
// container.ts is the only file allowed to import across all layers

/** Wires all adapters, assembles the workflow, and returns a ready-to-listen Express app.
 *  This is the only file that reads env vars and constructs concrete implementations. */
export function buildContainer() {
  const prefsFile    = process.env.PREFS_FILE          ?? resolve("config/user_preferences.json");
  const positionsFile = process.env.POSITIONS_FILE     ?? resolve("data/positions.json");
  const auditLogFile  = process.env.AUDIT_LOG_FILE     ?? resolve("data/audit.jsonl");
  const registryFile  = process.env.MARKET_REGISTRY_FILE ?? resolve("data/market_registry.json");

  const workflow = createWorkflow({
    marketSearch:   new GraphitiAdapter(),
    userPrefsRepo:  new JsonFileUserPrefsRepo(prefsFile),
    positionStore:  new JsonFilePositionStore(positionsFile),
    auditLogger:    new FileAuditLogger(auditLogFile),
    marketRegistry: new JsonFileMarketRegistry(registryFile),
    walletService:  new StubWalletService(),
    tradeExecutor:  new StubTradeExecutor(),
    swapExecutor:   new StubSwapExecutor(),
    walletAddress:  process.env.AGENT_WALLET_ADDRESS ?? "",
  });

  const runner = new WorkflowRunner(workflow);
  return createA2AServer(runner);
}
