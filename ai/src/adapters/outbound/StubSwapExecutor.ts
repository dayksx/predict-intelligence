import type { ISwapExecutor, SwapParams, SwapResult } from "../../ports/outbound/ISwapExecutor.js";

/** Stub — logs swap intent without executing. Replace with UniswapSwapExecutor for production. */
export class StubSwapExecutor implements ISwapExecutor {
  async executeSwap(params: SwapParams): Promise<SwapResult> {
    const label = params.dryRun ? "[dry-run]" : "[LIVE]";
    console.log(`${label} Swap: ${params.amountIn} ${params.tokenIn} → ${params.tokenOut}`);
    return { success: true, amountOut: params.amountIn * 0.9995 };
  }
}
