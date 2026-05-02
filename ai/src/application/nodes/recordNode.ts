import { v4 as uuidv4 } from "uuid";
import type { IPositionStore } from "../../ports/outbound/IPositionStore.js";
import type { IAuditLogger } from "../../ports/outbound/IAuditLogger.js";
import type { AgentState } from "../agentState.js";
import type { Position } from "../../domain/entities/position.js";

/** Persists new/closed positions and writes the final audit log entry. */
export function makeRecordNode(positionStore: IPositionStore, auditLogger: IAuditLogger) {
  return async function recordNode(state: AgentState): Promise<Partial<AgentState>> {
    const prefs = state.userPrefs!;
    const now = new Date().toISOString();

    for (const result of state.executionResults) {
      if (!result.success) continue;
      const decision = state.validatedDecisions.find((d) => d.id === result.decisionId);
      if (!decision) continue;

      if (decision.action === "trade" && decision.marketId) {
        const position: Position = {
          id: uuidv4(),
          market_id: decision.marketId,
          market_question: decision.marketId,
          direction: decision.direction ?? "YES",
          size_usdc: decision.sizeUsdc ?? prefs.max_position_usdc,
          entry_price: 0.5,
          entry_time: now,
          status: "open",
          dry_run: prefs.dry_run,
        };
        await positionStore.savePosition(position);
      } else if (decision.action === "close_position" && decision.positionId) {
        const pos = state.openPositions.find((p) => p.id === decision.positionId);
        if (pos) {
          const fillPrice = pos.current_price ?? pos.entry_price;
          const pnl = (fillPrice - pos.entry_price) * pos.size_usdc;
          await positionStore.closePosition(decision.positionId, fillPrice, now, pnl);
        }
      }
    }

    const opened = state.executionResults.filter((r) => r.action === "trade" && r.success).length;
    const closed = state.executionResults.filter((r) => r.action === "close_position" && r.success).length;
    const mode = prefs.dry_run ? " (dry run)" : "";

    const summary = [
      `Agent run complete${mode}.`,
      opened > 0 ? `Opened ${opened} new position(s).` : "",
      closed > 0 ? `Closed ${closed} position(s).` : "",
      state.validatedDecisions.length === 0
        ? "No actionable decisions after validation."
        : `Processed ${state.validatedDecisions.length} decision(s).`,
    ]
      .filter(Boolean)
      .join(" ");

    await auditLogger.writeLog({
      timestamp: now,
      runId: state.runId,
      event: "run_complete",
      data: { decisions: state.validatedDecisions, results: state.executionResults, summary },
    });

    console.log(`[record] ${summary}`);
    return { summary };
  };
}
