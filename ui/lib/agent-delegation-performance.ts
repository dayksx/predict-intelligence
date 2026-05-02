/**
 * Delegation vs outcomes snapshot for the agent dashboard.
 * Delegation is read from ENS (`agentic.delegatedAmount`). Wins / losses are
 * illustrative until a backend exposes realized P&L.
 */

export type DelegationPerformanceSnapshot = {
  /** Parsed from ENS; null if unset or invalid */
  delegatedEth: number | null;
  /** Sum of realized winning outcomes (ETH), illustrative when no API */
  realizedWinsEth: number;
  /** Sum of realized losing outcomes (ETH), illustrative when no API */
  realizedLossesEth: number;
  /** wins - losses */
  netRealizedEth: number;
  /** delegated + net (capital notionally still at play after outcomes) */
  effectiveBalanceEth: number;
  /** True when wins/losses are generated for demo — replace with API later */
  outcomesAreSample: boolean;
};

function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashLabelToSeed(label: string): number {
  let h = 2166136261;
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Parse `agentic.delegatedAmount` text record (decimal ETH string). */
export function parseDelegatedEthFromEns(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (t === "") return null;
  if (!/^\d*\.?\d+$/.test(t) || Number.isNaN(Number(t))) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * Builds wins/losses that scale with delegation (deterministic per label).
 * When delegation is unknown, uses a small reference scale for the diagram only.
 */
export function getDelegationPerformanceSnapshot(
  label: string,
  delegatedEth: number | null,
): DelegationPerformanceSnapshot {
  const rand = mulberry32(hashLabelToSeed(label.toLowerCase()));
  const base =
    delegatedEth != null && delegatedEth > 0 ? delegatedEth : 1;

  // Typical bands: wins ~1.5–6% of base, losses ~0.8–4% (deterministic)
  const winRate = 0.015 + rand() * 0.045;
  const lossRate = 0.008 + rand() * 0.032;
  let wins = base * winRate;
  let losses = base * lossRate;

  if (delegatedEth != null && delegatedEth > 0) {
    wins = delegatedEth * winRate;
    losses = delegatedEth * lossRate;
  }

  const net = wins - losses;
  const effective =
    delegatedEth != null && delegatedEth > 0
      ? delegatedEth + net
      : base + net;

  return {
    delegatedEth,
    realizedWinsEth: wins,
    realizedLossesEth: losses,
    netRealizedEth: net,
    effectiveBalanceEth: effective,
    outcomesAreSample: true,
  };
}

export function formatEthDisplay(n: number, maxFractionDigits = 4): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  }).format(n);
}

export function formatSignedEth(n: number, maxFractionDigits = 4): string {
  const abs = formatEthDisplay(Math.abs(n), maxFractionDigits);
  if (n > 0) return `+${abs}`;
  if (n < 0) return `−${abs}`;
  return formatEthDisplay(0, maxFractionDigits);
}
