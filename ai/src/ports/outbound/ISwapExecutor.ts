export interface SwapParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  dryRun: boolean;
}

export interface SwapResult {
  success: boolean;
  txHash?: string;
  amountOut?: number;
  error?: string;
}

export interface ISwapExecutor {
  executeSwap(params: SwapParams): Promise<SwapResult>;
}
