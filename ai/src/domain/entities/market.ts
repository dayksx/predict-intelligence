import { z } from "zod";

export const MarketFactZ = z.object({
  uuid: z.string(),
  name: z.string(),
  fact: z.string(),
  valid_at: z.string().nullable(),
  invalid_at: z.string().nullable(),
});

export type MarketFact = z.infer<typeof MarketFactZ>;
