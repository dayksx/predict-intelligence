import { z } from "zod";

export const PositionZ = z.object({
  id: z.string(),
  market_id: z.string(),
  market_question: z.string(),
  direction: z.enum(["YES", "NO"]),
  size_usdc: z.number(),
  entry_price: z.number(),
  entry_time: z.string(),
  status: z.enum(["open", "closed"]),
  exit_price: z.number().optional(),
  exit_time: z.string().optional(),
  pnl_usdc: z.number().optional(),
  dry_run: z.boolean().default(false),
});

export type Position = z.infer<typeof PositionZ>;

export type EnrichedPosition = Position & {
  current_price: number | null;
  days_held: number;
  unrealized_pnl_usdc: number | null;
};

export function enrichPosition(position: Position, currentPrice: number | null = null): EnrichedPosition {
  const days_held = Math.floor(
    (Date.now() - new Date(position.entry_time).getTime()) / (1000 * 60 * 60 * 24),
  );
  const unrealized_pnl_usdc =
    currentPrice !== null
      ? (currentPrice - position.entry_price) * position.size_usdc
      : null;
  return { ...position, current_price: currentPrice, days_held, unrealized_pnl_usdc };
}
