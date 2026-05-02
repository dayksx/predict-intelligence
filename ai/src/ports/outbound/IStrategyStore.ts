import type { TradingStrategy } from "../../domain/entities/strategy.js";

export interface IStrategyStore {
  /** Loads a single user's strategy by ENS name, or null if not found. */
  loadStrategy(ensName: string): Promise<TradingStrategy | null>;
  /** Returns all registered user strategies. */
  listAll(): Promise<TradingStrategy[]>;
}
