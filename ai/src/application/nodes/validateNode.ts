import type { AgentState } from "../agentState.js";
import { validateDecisions } from "../../domain/services/decisionValidatorService.js";

/** Filters raw LLM decisions: drops low-confidence new entries and no-op holds. */
export function makeValidateNode() {
  return function validateNode(state: AgentState): Partial<AgentState> {
    if (!state.strategy) return { validatedDecisions: [] };
    const threshold = state.strategy.confidence_threshold;
    const validatedDecisions = validateDecisions(state.decisions, threshold);

    for (const d of state.decisions) {
      const passed = validatedDecisions.includes(d);
      const reason = !passed
        ? d.action === "hold"
          ? "filtered: hold"
          : `confidence ${d.confidence ?? "null"} < threshold ${threshold}`
        : "passed";
      console.log(`[validate] ${d.action} | ${reason} | "${d.reasoning?.slice(0, 80)}"`);
    }

    console.log(`[validate] ${state.decisions.length} raw → ${validatedDecisions.length} validated`);
    return { validatedDecisions };
  };
}
