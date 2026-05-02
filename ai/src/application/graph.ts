import { StateGraph, START, END } from "@langchain/langgraph";
import { AgentStateAnnotation } from "./agentState.js";
import type { IMarketSearch } from "../ports/outbound/IMarketSearch.js";
import type { IUserPrefsRepo } from "../ports/outbound/IUserPrefsRepo.js";
import type { IPositionStore } from "../ports/outbound/IPositionStore.js";
import type { ITradeExecutor } from "../ports/outbound/ITradeExecutor.js";
import type { ISwapExecutor } from "../ports/outbound/ISwapExecutor.js";
import type { IWalletService } from "../ports/outbound/IWalletService.js";
import type { IAuditLogger } from "../ports/outbound/IAuditLogger.js";
import type { IMarketRegistry } from "../ports/outbound/IMarketRegistry.js";
import { makeIngestNode } from "./nodes/ingestNode.js";
import { makeRetrieveNode } from "./nodes/retrieveNode.js";
import { makeReasonNode } from "./nodes/reasonNode.js";
import { makeValidateNode } from "./nodes/validateNode.js";
import { makePreflightNode } from "./nodes/preflightNode.js";
import { makeActNode } from "./nodes/actNode.js";
import { makeRecordNode } from "./nodes/recordNode.js";

export interface WorkflowDeps {
  marketSearch: IMarketSearch;
  userPrefsRepo: IUserPrefsRepo;
  positionStore: IPositionStore;
  tradeExecutor: ITradeExecutor;
  swapExecutor: ISwapExecutor;
  walletService: IWalletService;
  auditLogger: IAuditLogger;
  marketRegistry: IMarketRegistry;
  walletAddress: string;
}

/**
 * Assembles the full LangGraph pipeline from injected port implementations.
 * Each node is a pure factory function — no framework coupling inside nodes.
 *
 * Pipeline: ingest → retrieve → reason → validate → preflight → act → record
 */
export function createWorkflow(deps: WorkflowDeps) {
  return new StateGraph(AgentStateAnnotation)
    .addNode("ingest", makeIngestNode(deps.userPrefsRepo, deps.positionStore))
    .addNode("retrieve", makeRetrieveNode(deps.marketSearch))
    .addNode("reason", makeReasonNode())
    .addNode("validate", makeValidateNode())
    .addNode("preflight", makePreflightNode(deps.walletService, deps.auditLogger))
    .addNode("act", makeActNode(deps.tradeExecutor, deps.swapExecutor, deps.auditLogger, deps.marketRegistry, deps.walletAddress))
    .addNode("record", makeRecordNode(deps.positionStore, deps.auditLogger))
    .addEdge(START, "ingest")
    .addEdge("ingest", "retrieve")
    .addEdge("retrieve", "reason")
    .addEdge("reason", "validate")
    .addEdge("validate", "preflight")
    .addEdge("preflight", "act")
    .addEdge("act", "record")
    .addEdge("record", END)
    .compile();
}

export type TradingWorkflow = ReturnType<typeof createWorkflow>;
