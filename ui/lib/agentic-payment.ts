import type { PublicClient } from "viem";
import { formatEther } from "viem";

/** Treasury that receives agent access fees — set in env for each deployment. */
export function getAgenticTreasuryAddress(): `0x${string}` | null {
  const env = process.env.NEXT_PUBLIC_AGENTIC_ADDRESS;
  if (env && /^0x[a-fA-F0-9]{40}$/.test(env.trim())) {
    return env.trim() as `0x${string}`;
  }
  return null;
}

/** Confirms the saved payment tx matches payer, treasury, and minimum ETH. */
export async function verifyAccessPaymentOnChain(
  publicClient: PublicClient,
  params: {
    txHash: `0x${string}`;
    payer: `0x${string}`;
    treasury: `0x${string}`;
    minValueWei: bigint;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const receipt = await publicClient.getTransactionReceipt({
      hash: params.txHash,
    });
    if (receipt.status !== "success") {
      return {
        ok: false,
        message: "Access payment transaction did not succeed on-chain.",
      };
    }
    const tx = await publicClient.getTransaction({ hash: params.txHash });
    const from = tx.from?.toLowerCase();
    const to = tx.to?.toLowerCase();
    if (!from || from !== params.payer.toLowerCase()) {
      return {
        ok: false,
        message: "That payment was not sent from your connected wallet.",
      };
    }
    if (!to || to !== params.treasury.toLowerCase()) {
      return {
        ok: false,
        message:
          "That payment was not sent to the configured treasury address.",
      };
    }
    const value = tx.value ?? BigInt(0);
    if (value < params.minValueWei) {
      return {
        ok: false,
        message: `Payment is below the required fee (need at least ${formatEther(params.minValueWei)} ETH).`,
      };
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      message:
        "Could not verify access payment. Confirm the tx is on Sepolia and try again.",
    };
  }
}
