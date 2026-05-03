import { HumanMessage } from "@langchain/core/messages";
import type { IWorkflowRunner, WorkflowRunOptions, WorkflowResult } from "../../ports/inbound/IWorkflowRunner.js";
import type { IStrategyStore } from "../../ports/outbound/IStrategyStore.js";
import type { Decision } from "../../domain/entities/decision.js";
import type { TradingStrategy } from "../../domain/entities/strategy.js";

/** Minimal structural interface for the compiled LangGraph workflow. */
interface InvokableWorkflow {
  invoke(
    input: Record<string, unknown>,
    options?: { configurable?: Record<string, unknown> },
  ): Promise<{ summary?: string; validatedDecisions?: Decision[] }>;
}

/** Factory that builds a per-user workflow wired with the correct stores. */
export type WorkflowFactory = (strategy: TradingStrategy) => InvokableWorkflow;

/**
 * Inbound adapter — implements IWorkflowRunner by invoking the LangGraph pipeline.
 * Accepts a workflowFactory so each A2A invocation gets per-user position/audit stores,
 * matching the behaviour of the daily scheduler.
 */
export class WorkflowRunner implements IWorkflowRunner {
  constructor(
    private readonly workflowFactory: WorkflowFactory,
    private readonly strategyStore: IStrategyStore,
  ) {}

  async run({ query, contextId }: WorkflowRunOptions): Promise<WorkflowResult> {
    let strategy: TradingStrategy | null = null;

    if (contextId) {
      strategy = await this.strategyStore.loadStrategy(contextId);
      if (!strategy) {
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

    // Build a fresh per-user workflow (with correct position/audit stores)
    const workflow = this.workflowFactory(strategy);

    // Alpha signals from the dashboard are explicit user instructions — relax confidence filter
    const isAlphaSignal = query.startsWith("[Alpha signal from user]");
    const effectiveStrategy = isAlphaSignal
      ? { ...strategy, confidence_threshold: 0.3 }
      : strategy;

    const result = await workflow.invoke(
      { messages: [new HumanMessage(query)], strategy: effectiveStrategy },
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
