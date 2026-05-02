/**
 * Delegation vs outcomes — delegated ETH comes from ENS when set.
 * Wins / losses come from your indexer when wired; until then optional mocks apply
 * (see `useMockDelegationYield` / `NEXT_PUBLIC_MOCK_AGENT_YIELD`).
 */

export interface DelegationYieldSnapshot {
  delegatedEth: number;
  realizedWinsEth: number;
  realizedLossesEth: number;
  /** wins − losses */
  netTradingEth: number;
  /** delegation + net P&L */
  bookEth: number;
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
  return {
    delegatedEth: delegated,
    realizedWinsEth: wins,
    realizedLossesEth: losses,
    netTradingEth: net,
    bookEth: roundEth(delegated + net),
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
