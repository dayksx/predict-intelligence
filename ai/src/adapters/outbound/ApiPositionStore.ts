import { z } from "zod";
import type { IPositionStore } from "../../ports/outbound/IPositionStore.js";
import { PositionZ, type Position } from "../../domain/entities/position.js";
import type { JsonFilePositionStore } from "./JsonFilePositionStore.js";

interface ApiPositionsResponse {
  positions?: Array<{ data_json: string }>;
}

/**
 * Persists positions via the api/ HTTP endpoints.
 * Falls back to the local JSON file store when the api is unreachable so the
 * ai module continues to function in fully-local mode.
 */
export class ApiPositionStore implements IPositionStore {
  constructor(
    private readonly apiUrl: string,
    private readonly ensName: string,
    private readonly fallback: JsonFilePositionStore,
  ) {}

  async loadOpen(): Promise<Position[]> {
    try {
      const res = await fetch(
        `${this.apiUrl}/positions/${encodeURIComponent(this.ensName)}?status=open`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as ApiPositionsResponse;
      const rows = body.positions ?? [];
      return rows
        .map((r) => PositionZ.safeParse(JSON.parse(r.data_json)))
        .filter((r) => r.success)
        .map((r) => (r as { success: true; data: Position }).data);
    } catch (err) {
      console.warn(`[ApiPositionStore] loadOpen falling back to file: ${String(err)}`);
      return this.fallback.loadOpen();
    }
  }

  async savePosition(position: Position): Promise<void> {
    await this.fallback.savePosition(position);
    await this.pushPosition(position);
  }

  async closePosition(
    id: string,
    exitPrice: number,
    exitTime: string,
    pnlUsdc: number,
  ): Promise<void> {
    await this.fallback.closePosition(id, exitPrice, exitTime, pnlUsdc);
    const closed: Partial<Position> & { id: string; status: "closed" } = {
      id,
      status: "closed",
      exit_price: exitPrice,
      exit_time: exitTime,
      pnl_usdc: pnlUsdc,
    };
    await this.pushPosition(closed as unknown as Position);
  }

  private async pushPosition(position: Position): Promise<void> {
    try {
      const res = await fetch(`${this.apiUrl}/ingest/positions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ensName: this.ensName, position }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.warn(`[ApiPositionStore] push failed (non-fatal): ${String(err)}`);
    }
  }
}
