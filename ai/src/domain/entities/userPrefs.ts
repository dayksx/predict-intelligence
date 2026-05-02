import { z } from "zod";

export const UserPrefsZ = z.object({
  dry_run: z.boolean().default(true),
  require_human_approval: z.boolean().default(true),
  max_position_usdc: z.number().default(10),
  max_total_exposure_pct: z.number().default(0.7),
  gas_reserve_eth: z.number().default(0.005),
  confidence_threshold: z.number().default(0.65),
  take_profit_pct: z.number().default(0.30),
  stop_loss_pct: z.number().default(0.20),
  max_days_open: z.number().default(30),
  preferred_domains: z.array(z.string()).default([]),
});

export type UserPrefs = z.infer<typeof UserPrefsZ>;
