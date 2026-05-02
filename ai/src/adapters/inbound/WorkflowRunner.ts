import { HumanMessage } from "@langchain/core/messages";
import type { IWorkflowRunner, WorkflowRunOptions, WorkflowResult } from "../../ports/inbound/IWorkflowRunner.js";
import type { IStrategyStore } from "../../ports/outbound/IStrategyStore.js";
import type { Decision } from "../../domain/entities/decision.js";
import type { TradingStrategy } from "../../domain/entities/strategy.js";

/** Minimal structural interface for the compiled LangGraph workflow.
 *  Defined here so this adapter doesn't need to import from the application layer. */
interface InvokableWorkflow {
  invoke(
    input: Record<string, unknown>,
    options?: { configurable?: Record<string, unknown> },
  ): Promise<{ summary?: string; validatedDecisions?: Decision[] }>;
}

/**
 * Inbound adapter — implements IWorkflowRunner by invoking the LangGraph pipeline.
 * Loads the per-user TradingStrategy from the store using contextId (ENS name),
 * then injects it as initial state before running the workflow.
 */
export class WorkflowRunner implements IWorkflowRunner {
  constructor(
    private readonly workflow: InvokableWorkflow,
    private readonly strategyStore: IStrategyStore,
  ) {}

  async run({ query, contextId }: WorkflowRunOptions): Promise<WorkflowResult> {
    let strategy: TradingStrategy | null = null;

    if (contextId) {
      strategy = await this.strategyStore.loadStrategy(contextId);
      if (!strategy) {
        // Fall back to first available profile (useful for testing with a single user)
        const all = await this.strategyStore.listAll();
        strategy = all[0] ?? null;
        if (strategy) {
          console.warn(`[WorkflowRunner] no profile for contextId "${contextId}", using "${strategy.ensName}"`);
        }
      }
    } else {
      const all = await this.strategyStore.listAll();
      strategy = all[0] ?? null;
    }

    if (!strategy) {
      return {
        contextId: contextId ?? "unknown",
        response: "No user profile found. Please register at predict-intelligence-ui.vercel.app first.",
        decisions: [],
        searchQueries: [],
      };
    }

    const result = await this.workflow.invoke(
      { messages: [new HumanMessage(query)], strategy },
      { configurable: { thread_id: contextId ?? strategy.ensName } },
    );

    return {
      contextId: contextId ?? strategy.ensName,
      response: result.summary || "Workflow completed with no summary.",
      decisions: result.validatedDecisions ?? [],
      searchQueries: [],
    };
  }
}
