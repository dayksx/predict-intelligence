import type { Position } from "../../domain/entities/position.js";

export interface IPositionStore {
  loadOpen(): Promise<Position[]>;
  savePosition(position: Position): Promise<void>;
  closePosition(id: string, exitPrice: number, exitTime: string, pnlUsdc: number): Promise<void>;
}
