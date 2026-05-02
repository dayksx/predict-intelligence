import { Annotation, MessagesAnnotation } from "@langchain/langgraph";
import type { UserPrefs } from "../domain/entities/userPrefs.js";
import type { EnrichedPosition } from "../domain/entities/position.js";
import type { MarketFact } from "../domain/entities/market.js";
import type { Decision, ToolResult } from "../domain/entities/decision.js";

export const AgentStateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  runId: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
  userPrefs: Annotation<UserPrefs | null>({ reducer: (_, b) => b, default: () => null }),
  openPositions: Annotation<EnrichedPosition[]>({ reducer: (_, b) => b, default: () => [] }),
  marketFacts: Annotation<MarketFact[]>({ reducer: (_, b) => b, default: () => [] }),
  decisions: Annotation<Decision[]>({ reducer: (_, b) => b, default: () => [] }),
  validatedDecisions: Annotation<Decision[]>({ reducer: (_, b) => b, default: () => [] }),
  executionResults: Annotation<ToolResult[]>({ reducer: (_, b) => b, default: () => [] }),
  summary: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
});

export type AgentState = typeof AgentStateAnnotation.State;
