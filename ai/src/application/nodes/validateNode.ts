import type { AgentState } from "../agentState.js";
import { validateDecisions } from "../../domain/services/decisionValidatorService.js";

/** Filters raw LLM decisions: drops low-confidence new entries and no-op holds. */
export function makeValidateNode() {
  return function validateNode(state: AgentState): Partial<AgentState> {
    if (!state.userPrefs) return { validatedDecisions: [] };
    const validatedDecisions = validateDecisions(state.decisions, state.userPrefs);
    console.log(`[validate] ${state.decisions.length} raw → ${validatedDecisions.length} validated`);
    return { validatedDecisions };
  };
}
