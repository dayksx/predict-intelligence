import type { Decision } from "../entities/decision.js";

export interface WalletBalances {
  usdc: number;
  eth: number;
  weth: number;
}

export interface GuardResult {
  allowed: Decision[];
  blocked: Array<{ decision: Decision; reason: string }>;
}

/** Pure function — no I/O. Applies position size and exposure caps to a set of decisions. */
export function applyPortfolioGuards(
  decisions: Decision[],
  balances: WalletBalances,
  maxPositionUsdc: number,
  maxTotalExposurePct: number,
  gasReserveEth: number,
): GuardResult {
  const allowed: Decision[] = [];
  const blocked: Array<{ decision: Decision; reason: string }> = [];

  if (balances.eth < gasReserveEth) {
    return {
      allowed: [],
      blocked: decisions.map((d) => ({
        decision: d,
        reason: `Insufficient ETH for gas: ${balances.eth} ETH < reserve ${gasReserveEth} ETH`,
      })),
    };
  }

  let committedUsdc = 0;

  for (const d of decisions) {
    if (d.action === "close_position" || d.action === "hold_open") {
      allowed.push(d);
      continue;
    }

    const size = d.sizeUsdc ?? maxPositionUsdc;

    if (size > maxPositionUsdc) {
      blocked.push({ decision: d, reason: `Size $${size} exceeds max position $${maxPositionUsdc}` });
      continue;
    }

    if (committedUsdc + size > balances.usdc * maxTotalExposurePct) {
      blocked.push({
        decision: d,
        reason: `Would exceed max exposure (${(maxTotalExposurePct * 100).toFixed(0)}% of $${balances.usdc.toFixed(2)})`,
      });
      continue;
    }

    committedUsdc += size;
    allowed.push(d);
  }

  return { allowed, blocked };
}
