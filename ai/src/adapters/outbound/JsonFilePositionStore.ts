import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { dirname } from "path";
import { z } from "zod";
import type { IPositionStore } from "../../ports/outbound/IPositionStore.js";
import { PositionZ, type Position } from "../../domain/entities/position.js";

export class JsonFilePositionStore implements IPositionStore {
  constructor(private readonly filePath: string) {}

  private async load(): Promise<Position[]> {
    if (!existsSync(this.filePath)) return [];
    const raw = await readFile(this.filePath, "utf-8");
    return z.array(PositionZ).parse(JSON.parse(raw));
  }

  private async save(positions: Position[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(positions, null, 2));
  }

  async loadOpen(): Promise<Position[]> {
    return (await this.load()).filter((p) => p.status === "open");
  }

  async savePosition(position: Position): Promise<void> {
    const positions = await this.load();
    positions.push(position);
    await this.save(positions);
  }

  async closePosition(id: string, exitPrice: number, exitTime: string, pnlUsdc: number): Promise<void> {
    const positions = await this.load();
    const idx = positions.findIndex((p) => p.id === id);
    if (idx !== -1) {
      positions[idx] = { ...positions[idx], status: "closed", exit_price: exitPrice, exit_time: exitTime, pnl_usdc: pnlUsdc };
      await this.save(positions);
    }
  }
}
