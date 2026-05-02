import { z } from "zod";

export const DecisionZ = z.object({
  id: z.string(),
  action: z.enum(["trade", "swap", "close_position", "hold_open", "hold"]),
  marketId: z.string().nullable(),
  positionId: z.string().nullable(),
  direction: z.enum(["YES", "NO"]).nullable(),
  sizeUsdc: z.number().nullable(),
  tokenIn: z.string().nullable().default(null),
  tokenOut: z.string().nullable().default(null),
  // Polymarket CLOB-specific fields
  clobTokenId: z.string().nullable().default(null),
  negRisk: z.boolean().nullable().default(null),
  yesPrice: z.number().nullable().default(null),
  noPrice: z.number().nullable().default(null),
  sell: z.boolean().nullable().default(null),
  sources: z.array(z.string()).default([]),
  confidence: z.number().nullable().default(0.5),
  reasoning: z.string(),
});

export type Decision = z.infer<typeof DecisionZ>;

/** Returned by executors and tools; decisionId/action are added by actNode. */
export interface ToolResult {
  success: boolean;
  txHash?: string;
  error?: string;
  dryRun: boolean;
  decisionId?: string;
  action?: string;
}
