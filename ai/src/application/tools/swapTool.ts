import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { ISwapExecutor } from "../../ports/outbound/ISwapExecutor.js";

/** Returns a LangChain tool backed by the injected ISwapExecutor port.
 *  In the current pipeline actNode dispatches this deterministically.
 *  Expose it via bindTools() to enable LLM-driven swaps in future hybrid workflows. */
export function makeSwapTool(swapExecutor: ISwapExecutor, dryRun: boolean) {
  return tool(
    async ({ tokenIn, tokenOut, amountIn }) => {
      try {
        const result = await swapExecutor.executeSwap({ tokenIn, tokenOut, amountIn, dryRun });
        if (!result.success) return `Swap failed: ${result.error}`;
        const out = result.amountOut !== undefined ? ` → ${result.amountOut.toFixed(4)} ${tokenOut}` : "";
        const label = dryRun ? "(dry run)" : result.txHash ?? "submitted";
        return `Swap executed ${label}: ${amountIn} ${tokenIn}${out}`;
      } catch (err) {
        return `Swap error: ${err}`;
      }
    },
    {
      name: "uniswap_swap",
      description:
        "Swap tokens using Uniswap v3 on Base. " +
        "Specify the input token, output token, and amount to swap.",
      schema: z.object({
        tokenIn: z.string().describe("Token symbol to swap from, e.g. USDC"),
        tokenOut: z.string().describe("Token symbol to swap to, e.g. WETH"),
        amountIn: z.number().describe("Amount of tokenIn to swap"),
      }),
    },
  );
}
