import { HumanMessage } from "@langchain/core/messages";
import type { AIMessage } from "@langchain/core/messages";
import type { IWorkflowRunner, WorkflowRunOptions, WorkflowResult } from "../../ports/inbound/IWorkflowRunner.js";
import { createAgent } from "../../application/graph.js";

/**
 * Inbound adapter — implements IWorkflowRunner by running the LangGraph agent.
 * Sits between the A2A server (primary driver) and the agent core.
 */
export class WorkflowRunner implements IWorkflowRunner {
  private readonly agent = createAgent();

  async run({ query, contextId }: WorkflowRunOptions): Promise<WorkflowResult> {
    const result = await this.agent.invoke(
      { messages: [new HumanMessage(query)] },
      { configurable: { thread_id: contextId }, recursionLimit: 6 }
    );

    const last = result.messages.at(-1) as AIMessage;
    const response =
      typeof last?.content === "string"
        ? last.content
        : JSON.stringify(last?.content);

    const searchQueries: string[] = [];
    const seen = new Set<string>();
    for (const msg of result.messages) {
      const ai = msg as AIMessage;
      for (const tc of ai.tool_calls ?? []) {
        const q = tc.args?.query as string | undefined;
        if (q && !seen.has(q)) { seen.add(q); searchQueries.push(q); }
      }
    }

    return { contextId, response, searchQueries };
  }
}
