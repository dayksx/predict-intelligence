/**
 * Delegation vs outcomes — delegated ETH comes from ENS when set.
 * Wins / losses come from your indexer when wired; until then optional mocks apply
 * (see `useMockDelegationYield` / `NEXT_PUBLIC_MOCK_AGENT_YIELD`).
 */

/** Realized P&amp;L split by venue until your indexer supplies fills. */
export interface ServicePnLEntry {
  gainEth: number;
  lossEth: number;
}

export interface DelegationYieldSnapshot {
  delegatedEth: number;
  realizedWinsEth: number;
  realizedLossesEth: number;
  /** wins − losses */
  netTradingEth: number;
  /** delegation + net P&L */
  bookEth: number;
  /** Swap / perpetuals / prediction markets — gains & losses (ETH). */
  servicePnL: {
    swap: ServicePnLEntry;
    perps: ServicePnLEntry;
    predict: ServicePnLEntry;
  };
}

function roundEth(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

/** When true, wins/losses use demo ETH until an API/indexer fills real values. */
export function useMockDelegationYield(): boolean {
  const raw = process.env.NEXT_PUBLIC_MOCK_AGENT_YIELD;
  if (raw === "false" || raw === "0") return false;
  if (raw === "true" || raw === "1") return true;
  return process.env.NODE_ENV === "development";
}

/** Illustrative wins/losses as fractions of delegated stake (deterministic demo). */
function mockWinsLossesFromDelegated(delegatedEth: number): {
  wins: number;
  losses: number;
} {
  if (delegatedEth > 0) {
    return {
      wins: roundEth(delegatedEth * 0.071),
      losses: roundEth(delegatedEth * 0.039),
    };
  }
  return { wins: 0.018, losses: 0.007 };
}

/** Split a total across three buckets with fixed ratios; last bucket absorbs rounding. */
function splitEthThree(
  total: number,
  ratios: readonly [number, number, number],
): [number, number, number] {
  if (total <= 0) return [0, 0, 0];
  const [r0, r1, r2] = ratios;
  const s = r0 + r1 + r2;
  const a = roundEth((total * r0) / s);
  const b = roundEth((total * r1) / s);
  const c = roundEth(total - a - b);
  return [a, b, Math.max(0, c)];
}

function emptyServicePnL(): DelegationYieldSnapshot["servicePnL"] {
  const z = { gainEth: 0, lossEth: 0 };
  return { swap: { ...z }, perps: { ...z }, predict: { ...z } };
}

/** Mock venue split: swap-heavy, then perps, then prediction markets. */
function mockServicePnL(wins: number, losses: number): DelegationYieldSnapshot["servicePnL"] {
  const wg = splitEthThree(wins, [0.42, 0.33, 0.25]);
  const wl = splitEthThree(losses, [0.38, 0.35, 0.27]);
  return {
    swap: { gainEth: wg[0], lossEth: wl[0] },
    perps: { gainEth: wg[1], lossEth: wl[1] },
    predict: { gainEth: wg[2], lossEth: wl[2] },
  };
}

/** Parse ETH string from ENS; returns null if empty/invalid. */
export function parseDelegatedEthFromEns(
  raw: string | null | undefined,
): number | null {
  if (raw == null || !String(raw).trim()) return null;
  const n = Number(String(raw).trim().replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/** Snapshot with real delegation from ENS when present; wins/losses from indexer or mocks. */
export function getDelegationYieldSnapshot(
  ensDelegatedAmount: string | null | undefined,
): DelegationYieldSnapshot {
  const delegated = parseDelegatedEthFromEns(ensDelegatedAmount) ?? 0;
  let wins = 0;
  let losses = 0;

  if (useMockDelegationYield()) {
    const m = mockWinsLossesFromDelegated(delegated);
    wins = m.wins;
    losses = m.losses;
  }

  const net = roundEth(wins - losses);
  const servicePnL =
    useMockDelegationYield() && (wins > 0 || losses > 0)
      ? mockServicePnL(wins, losses)
      : emptyServicePnL();

  return {
    delegatedEth: delegated,
    realizedWinsEth: wins,
    realizedLossesEth: losses,
    netTradingEth: net,
    bookEth: roundEth(delegated + net),
    servicePnL,
  };
}

export function formatEthDisplay(eth: number): string {
  if (eth === 0) return "0";
  const abs = Math.abs(eth);
  const decimals = abs >= 100 ? 2 : abs >= 1 ? 3 : 4;
  return eth.toLocaleString(undefined, {
    minimumFractionDigits: Math.min(decimals, 2),
    maximumFractionDigits: decimals,
  });
}
