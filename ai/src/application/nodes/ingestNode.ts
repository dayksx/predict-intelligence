import { v4 as uuidv4 } from "uuid";
import type { IUserPrefsRepo } from "../../ports/outbound/IUserPrefsRepo.js";
import type { IPositionStore } from "../../ports/outbound/IPositionStore.js";
import type { AgentState } from "../agentState.js";
import { enrichPosition } from "../../domain/entities/position.js";

/** Loads user preferences and open positions, enriches positions with days_held. */
export function makeIngestNode(userPrefsRepo: IUserPrefsRepo, positionStore: IPositionStore) {
  return async function ingestNode(_state: AgentState): Promise<Partial<AgentState>> {
    const [userPrefs, rawPositions] = await Promise.all([
      userPrefsRepo.loadPrefs(),
      positionStore.loadOpen(),
    ]);
    const openPositions = rawPositions.map((p) => enrichPosition(p));
    return { runId: uuidv4(), userPrefs, openPositions };
  };
}
