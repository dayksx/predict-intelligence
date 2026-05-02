import type { Decision } from "../../domain/entities/decision.js";

/** Inbound port — defines how the A2A server drives the agent workflow. */

export interface WorkflowRunOptions {
  query: string;
  contextId: string;
}

export interface WorkflowResult {
  contextId: string;
  response: string;
  decisions: Decision[];
  searchQueries: string[];
}

export interface IWorkflowRunner {
  run(options: WorkflowRunOptions): Promise<WorkflowResult>;
}
