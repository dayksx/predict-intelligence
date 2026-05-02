import { v4 as uuidv4 } from "uuid";
import type { IPositionStore } from "../../ports/outbound/IPositionStore.js";
import type { AgentState } from "../agentState.js";
import { enrichPosition } from "../../domain/entities/position.js";

/**
 * Loads open positions for the user identified by state.strategy.
 * Strategy must already be set in state (injected by the scheduler or WorkflowRunner).
 */
export function makeIngestNode(positionStore: IPositionStore) {
  return async function ingestNode(state: AgentState): Promise<Partial<AgentState>> {
    if (!state.strategy) throw new Error("ingestNode: strategy missing — must be set in initial state");

    const rawPositions = await positionStore.loadOpen();
    const openPositions = rawPositions.map((p) => enrichPosition(p));

    console.log(`[ingest] user:${state.strategy.ensName} | ${openPositions.length} open position(s)`);
    return { runId: uuidv4(), openPositions };
  };
}
