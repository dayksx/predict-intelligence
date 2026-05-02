import type { IWalletService, WalletBalances } from "../../ports/outbound/IWalletService.js";

/** Stub — returns dummy balances. Replace with ViemWalletService for production. */
export class StubWalletService implements IWalletService {
  async getBalances(): Promise<WalletBalances> {
    return { usdc: 100, eth: 0.1, weth: 0 };
  }

  async approve(_tokenAddress: string, _spenderAddress: string, _amountUsdc: number): Promise<void> {
    // no-op in stub
  }
}
