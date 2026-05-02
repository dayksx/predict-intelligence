/** Rotating copy for the live console — reads as “always doing something” until real telemetry exists. */

export type LivePhase = "perceive" | "reason" | "act" | "system";

export interface LiveFeedLine {
  id: string;
  phase: LivePhase;
  message: string;
  at: string;
}

const ROTATING: { phase: LivePhase; message: string }[] = [
  {
    phase: "perceive",
    message: "Polling prediction-market cohort for new liquidity signals…",
  },
  {
    phase: "reason",
    message: "Cross-checking thesis tags against latest regime-risk headlines…",
  },
  {
    phase: "perceive",
    message: "Refreshing Polymarket Gamma snapshot (pagination slice 1–3)…",
  },
  {
    phase: "reason",
    message: "Scoring alignment with your stated focus areas from ENS metadata…",
  },
  {
    phase: "act",
    message: "Standing by for actionable triggers (no autonomous txs without your prompts)…",
  },
  {
    phase: "system",
    message: "Heartbeat OK · subgraph indexer reachable · RPC latency nominal.",
  },
];

export function nextSyntheticLine(seed: string, tick: number): LiveFeedLine {
  const i =
    (tick + seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) %
    ROTATING.length;
  const row = ROTATING[i] ?? ROTATING[0];
  return {
    id: `${Date.now()}-${tick}-${i}`,
    phase: row.phase,
    message: row.message,
    at: new Date().toISOString(),
  };
}

export function phaseLabel(phase: LivePhase): string {
  switch (phase) {
    case "perceive":
      return "Perceive";
    case "reason":
      return "Reason";
    case "act":
      return "Act";
    default:
      return "System";
  }
}
