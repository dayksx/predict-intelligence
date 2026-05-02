import { HumanMessage } from "@langchain/core/messages";
import type { IWorkflowRunner, WorkflowRunOptions, WorkflowResult } from "../../ports/inbound/IWorkflowRunner.js";
import type { Decision } from "../../domain/entities/decision.js";

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
 * Receives the compiled workflow from the container (DI) rather than creating it.
 */
export class WorkflowRunner implements IWorkflowRunner {
  constructor(private readonly workflow: InvokableWorkflow) {}

  async run({ query, contextId }: WorkflowRunOptions): Promise<WorkflowResult> {
    const result = await this.workflow.invoke(
      { messages: [new HumanMessage(query)] },
      { configurable: { thread_id: contextId } },
    );

    return {
      contextId,
      response: result.summary || "Workflow completed with no summary.",
      decisions: result.validatedDecisions ?? [],
      searchQueries: [],
    };
  }
}
