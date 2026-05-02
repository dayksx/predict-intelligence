import type { IWalletService } from "../../ports/outbound/IWalletService.js";
import type { IAuditLogger } from "../../ports/outbound/IAuditLogger.js";
import type { AgentState } from "../agentState.js";
import { applyPortfolioGuards } from "../../domain/services/portfolioGuardService.js";

/** Checks wallet balances and applies portfolio guards before any on-chain action.
 *  In dry_run mode, skips balance checks and passes all validated decisions through. */
export function makePreflightNode(walletService: IWalletService, auditLogger: IAuditLogger) {
  return async function preflightNode(state: AgentState): Promise<Partial<AgentState>> {
    const prefs = state.userPrefs!;

    if (prefs.dry_run) {
      await auditLogger.writeLog({
        timestamp: new Date().toISOString(),
        runId: state.runId,
        event: "preflight_dry_run",
        data: { decisions: state.validatedDecisions.length },
      });
      return {};
    }

    const balances = await walletService.getBalances();
    const { allowed, blocked } = applyPortfolioGuards(
      state.validatedDecisions,
      balances,
      prefs.max_position_usdc,
      prefs.max_total_exposure_pct,
      prefs.gas_reserve_eth,
    );

    for (const { decision, reason } of blocked) {
      console.warn(`[preflight] blocked: ${decision.id} — ${reason}`);
      await auditLogger.writeLog({
        timestamp: new Date().toISOString(),
        runId: state.runId,
        event: "decision_blocked",
        data: { decision, reason },
      });
    }

    return { validatedDecisions: allowed };
  };
}
