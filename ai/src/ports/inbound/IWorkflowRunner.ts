/** Inbound port — defines how the A2A server drives the agent workflow. */

export interface WorkflowRunOptions {
  query: string;
  contextId: string;
}

export interface WorkflowResult {
  contextId: string;
  response: string;
  searchQueries: string[];
}

export interface IWorkflowRunner {
  run(options: WorkflowRunOptions): Promise<WorkflowResult>;
}
