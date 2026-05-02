import type { Decision } from "../entities/decision.js";
import type { UserPrefs } from "../entities/userPrefs.js";

/** Filters raw LLM decisions through validation rules.
 *  Close/hold_open always pass — they protect existing capital.
 *  New entries must meet the confidence threshold. */
export function validateDecisions(decisions: Decision[], prefs: UserPrefs): Decision[] {
  return decisions.filter((d) => {
    if (d.action === "close_position" || d.action === "hold_open") return true;
    if (d.action === "hold") return false;
    return d.confidence >= prefs.confidence_threshold;
  });
}
