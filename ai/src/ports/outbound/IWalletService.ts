export interface WalletBalances {
  usdc: number;
  eth: number;
  weth: number;
}

export interface IWalletService {
  getBalances(): Promise<WalletBalances>;
  approve(tokenAddress: string, spenderAddress: string, amountUsdc: number): Promise<void>;
}
