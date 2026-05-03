import {
  createPublicClient,
  createWalletClient,
  formatUnits,
  http,
  parseUnits,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

import type { ISwapExecutor, SwapParams, SwapResult } from "../../ports/outbound/ISwapExecutor.js";

const API_BASE = "https://trade-api.gateway.uniswap.org/v1";
const DEXSCREENER_BASE = "https://api.dexscreener.com";

/** Chain ID for Sepolia testnet — override with UNISWAP_CHAIN_ID env var */
const DEFAULT_CHAIN_ID = 11155111;

/**
 * Mainnet token addresses used for DexScreener price/liquidity lookups.
 * Sepolia tokens have no real liquidity; we look up mainnet prices as reference.
 */
const MAINNET_TOKENS: Record<string, string> = {
  WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  DAI:  "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  UNI:  "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
  WBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
};

/**
 * Known ERC-20 / native token addresses on Sepolia.
 * Add more pairs as needed — the agent resolves by symbol (case-insensitive).
 */
const SEPOLIA_TOKENS: Record<string, { address: `0x${string}`; decimals: number }> = {
  ETH:  { address: "0x0000000000000000000000000000000000000000", decimals: 18 },
  WETH: { address: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14", decimals: 18 },
  USDC: { address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", decimals: 6 },
  USDT: { address: "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0", decimals: 6 },
  DAI:  { address: "0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357", decimals: 18 },
  UNI:  { address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", decimals: 18 },
};

type TokenInfo = (typeof SEPOLIA_TOKENS)[string];

/** Wraps the Uniswap Trading API (trade-api.gateway.uniswap.org) to execute swaps on Sepolia. */
export class UniswapSwapExecutor implements ISwapExecutor {
  private readonly apiKey: string;
  private readonly walletAddress: `0x${string}`;
  private readonly privateKey: string | null;
  private readonly rpcUrl: string;
  private readonly chainId: number;
  private readonly apiBase: string;
  private readonly dexScreenerBase: string;

  constructor() {
    this.apiKey          = process.env.UNISWAP_API_KEY ?? "";
    this.walletAddress   = (process.env.AGENT_WALLET_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;
    this.privateKey      = process.env.AGENT_PRIVATE_KEY ?? null;
    this.rpcUrl          = process.env.SEPOLIA_RPC_URL ?? "https://rpc.sepolia.org";
    this.chainId         = parseInt(process.env.UNISWAP_CHAIN_ID ?? String(DEFAULT_CHAIN_ID));
    this.apiBase         = process.env.UNISWAP_API_BASE ?? API_BASE;
    this.dexScreenerBase = process.env.DEXSCREENER_BASE_URL ?? DEXSCREENER_BASE;
  }

  async executeSwap(params: SwapParams): Promise<SwapResult> {
    const tokenIn  = SEPOLIA_TOKENS[params.tokenIn.toUpperCase()];
    const tokenOut = SEPOLIA_TOKENS[params.tokenOut.toUpperCase()];

    if (!tokenIn || !tokenOut) {
      const known = Object.keys(SEPOLIA_TOKENS).join(", ");
      return {
        success: false,
        error: `Unknown token symbol: "${params.tokenIn}" or "${params.tokenOut}". Supported: ${known}`,
      };
    }

    if (!this.apiKey) {
      return { success: false, error: "UNISWAP_API_KEY is not set" };
    }

    // ETH → WETH wrap uses sendTransaction directly (no pool needed, always available on Sepolia)
    const isEthToWeth =
      params.tokenIn.toUpperCase() === "ETH" && params.tokenOut.toUpperCase() === "WETH";
    if (isEthToWeth && this.privateKey) {
      return this.wrapEth(tokenOut.address, parseUnits(String(params.amountIn), 18).toString(), params);
    }

    const amountRaw = parseUnits(String(params.amountIn), tokenIn.decimals).toString();

    // Swaps run on Sepolia testnet — no real money is at risk.
    // Execute when a private key is available; fall back to quote-only mode otherwise.
    // The strategy-level dry_run flag governs Polymarket (mainnet) trades only and is
    // intentionally ignored here.
    return this.privateKey
      ? this.liveSwap(tokenIn, tokenOut, amountRaw, params)
      : this.quoteOnly(tokenIn, tokenOut, amountRaw, params);
  }

  // ─── Quote-only: fetch quote without broadcasting (no private key) ──────────

  private async quoteOnly(
    tokenIn: TokenInfo,
    tokenOut: TokenInfo,
    amountRaw: string,
    params: SwapParams,
  ): Promise<SwapResult> {
    console.log(
      `[uniswap][quote-only] no AGENT_PRIVATE_KEY set — quoting ${params.amountIn} ${params.tokenIn} → ${params.tokenOut}`,
    );
    // Log mainnet reference price via DexScreener before quoting
    await this.logDexScreenerPrice(params.tokenOut);
    try {
      const quoteRes = await this.fetchQuote(tokenIn.address, tokenOut.address, amountRaw);
      const quoteObj = quoteRes["quote"] as { output?: { amount?: string }; routeString?: string; chainId?: number } | undefined;
      const outputRaw = quoteObj?.output?.amount;
      const amountOut = outputRaw ? parseFloat(formatUnits(BigInt(outputRaw), tokenOut.decimals)) : undefined;
      const route = quoteObj?.routeString ?? `chainId:${quoteObj?.chainId ?? this.chainId}`;
      console.log(
        `[uniswap][quote-only] ${params.amountIn} ${params.tokenIn} → ${amountOut?.toFixed(6) ?? "?"} ${params.tokenOut} | ${route}`,
      );
      return { success: true, amountOut };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error("[uniswap][quote-only] failed:", error);
      return { success: false, error };
    }
  }

  // ─── Live: approve → quote → sign permit → swap → broadcast ───────────────

  private async liveSwap(
    tokenIn: TokenInfo,
    tokenOut: TokenInfo,
    amountRaw: string,
    params: SwapParams,
  ): Promise<SwapResult> {
    if (!this.privateKey) {
      return { success: false, error: "AGENT_PRIVATE_KEY is required for live swaps" };
    }

    const account = privateKeyToAccount(`0x${this.privateKey.replace(/^0x/, "")}` as Hex);
    const transport = http(this.rpcUrl);
    const publicClient = createPublicClient({ chain: sepolia, transport });
    const walletClient = createWalletClient({ account, chain: sepolia, transport });

    try {
      console.log(`[uniswap][live] ${params.amountIn} ${params.tokenIn} → ${params.tokenOut}`);
      // Check mainnet reference price via DexScreener before committing
      await this.logDexScreenerPrice(params.tokenOut);

      // Pre-flight balance check — native ETH and ERC-20 both guarded
      const isNative = tokenIn.address === "0x0000000000000000000000000000000000000000";
      if (isNative) {
        const ethBalance = await publicClient.getBalance({ address: account.address });
        const gasReserve = parseUnits("0.01", 18);
        const maxSwappable = ethBalance > gasReserve ? ethBalance - gasReserve : 0n;
        const needed = BigInt(amountRaw);
        if (maxSwappable === 0n || needed > maxSwappable) {
          const have = formatUnits(ethBalance, 18);
          const need = formatUnits(needed, 18);
          const msg = `Insufficient ETH: have ${have}, need ${need} + 0.01 gas reserve. Fund wallet or reduce swap size.`;
          console.error(`[uniswap][live] ${msg}`);
          return { success: false, error: msg };
        }
        console.log(`[uniswap][live] ETH balance OK: ${formatUnits(ethBalance, 18)} ETH`);
      } else {
        const balanceResult = await publicClient.readContract({
          address: tokenIn.address,
          abi: [{ name: "balanceOf", type: "function", stateMutability: "view",
                  inputs: [{ name: "account", type: "address" }],
                  outputs: [{ name: "", type: "uint256" }] }],
          functionName: "balanceOf",
          args: [account.address],
        });
        const balance = balanceResult as bigint;
        const needed = BigInt(amountRaw);
        if (balance < needed) {
          const haveHuman = formatUnits(balance, tokenIn.decimals);
          const needHuman = formatUnits(needed, tokenIn.decimals);
          const msg = `Insufficient ${params.tokenIn} balance on Sepolia: have ${haveHuman}, need ${needHuman}. Get testnet tokens from faucet.circle.com (USDC) or sepoliafaucet.com (ETH).`;
          console.error(`[uniswap][live] ${msg}`);
          return { success: false, error: msg };
        }
        console.log(`[uniswap][live] balance OK: ${formatUnits(balance, tokenIn.decimals)} ${params.tokenIn}`);
      }

      // 1. ERC-20 approval via Permit2
      if (!isNative) {
        const approval = await this.checkApproval(tokenIn.address, amountRaw, account.address);
        if (approval?.["approval"]) {
          const approveTx = approval["approval"] as { to: string; data: string; value?: string };
          console.log("[uniswap][live] submitting approval tx…");
          const approvalHash = await walletClient.sendTransaction({
            to:    approveTx.to   as `0x${string}`,
            data:  approveTx.data as `0x${string}`,
            value: BigInt(approveTx.value ?? "0"),
          });
          await publicClient.waitForTransactionReceipt({ hash: approvalHash });
          console.log(`[uniswap][live] approval confirmed: ${approvalHash}`);
        }
      }

      // 2. Get best-price quote
      const quoteRes = await this.fetchQuote(tokenIn.address, tokenOut.address, amountRaw);
      const { quote, permitData, routing } = quoteRes as {
        quote: unknown;
        permitData: unknown;
        routing: string | undefined;
      };

      // 3. Sign Permit2 typed-data if the quote requires it
      let signature: string | undefined;
      if (permitData) {
        const pd = permitData as { domain: object; types: object; values: object };
        signature = await walletClient.signTypedData({
          domain:      pd.domain as Parameters<typeof walletClient.signTypedData>[0]["domain"],
          types:       pd.types  as Parameters<typeof walletClient.signTypedData>[0]["types"],
          primaryType: "PermitSingle",
          message:     pd.values as Record<string, unknown>,
        });
        console.log("[uniswap][live] permit signed");
      }

      // 4a. UniswapX (gasless) — submit via /order; filler broadcasts on-chain
      const isUniswapX = routing === "DUTCH_V2" || routing === "DUTCH_V3" || routing === "PRIORITY";
      if (isUniswapX) {
        await this.submitOrder(quote, signature);
        console.log("[uniswap][live] UniswapX order submitted (gasless — filler will broadcast)");
        return { success: true };
      }

      // 4b. Classic routing (V2/V3/V4) — build calldata via /swap and broadcast
      const swapRes = await this.fetchSwapTx(quote, permitData, signature);
      const tx = (swapRes["swap"] ?? {}) as {
        to: string; data: string; value?: string;
        maxFeePerGas: string; maxPriorityFeePerGas: string; gasLimit: string;
      };

      // 5. Broadcast
      const hash = await walletClient.sendTransaction({
        to:                  tx["to"]                  as `0x${string}`,
        data:                tx["data"]                as `0x${string}`,
        value:               BigInt(tx["value"] ?? "0"),
        maxFeePerGas:        BigInt(tx["maxFeePerGas"]),
        maxPriorityFeePerGas: BigInt(tx["maxPriorityFeePerGas"]),
        gas:                 BigInt(tx["gasLimit"]),
      });
      await publicClient.waitForTransactionReceipt({ hash });

      const outputRaw = (quote as { output?: { amount?: string } })?.output?.amount;
      const amountOut = outputRaw ? parseFloat(formatUnits(BigInt(outputRaw), tokenOut.decimals)) : undefined;
      console.log(`[uniswap][live] swap confirmed: ${hash}`);
      return { success: true, txHash: hash, amountOut };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error("[uniswap][live] swap failed:", error);
      return { success: false, error };
    }
  }

  // ─── ETH → WETH wrap (no pool needed, always works on Sepolia) ────────────

  private async wrapEth(
    wethAddress: string,
    amountWei: string,
    params: SwapParams,
  ): Promise<SwapResult> {
    console.log(`[uniswap][wrap] wrapping ${params.amountIn} ETH → WETH on Sepolia`);
    try {
      const account = privateKeyToAccount(`0x${this.privateKey!.replace(/^0x/, "")}` as Hex);
      const transport = http(this.rpcUrl);
      const publicClient = createPublicClient({ chain: sepolia, transport });
      const walletClient = createWalletClient({ account, chain: sepolia, transport });

      // Call WETH.deposit() with ETH value — the canonical wrap method
      const hash = await walletClient.sendTransaction({
        to:   wethAddress as `0x${string}`,
        data: "0xd0e30db0",           // deposit() selector
        value: BigInt(amountWei),
      });
      await publicClient.waitForTransactionReceipt({ hash });
      const amountOut = parseFloat(formatUnits(BigInt(amountWei), 18));
      console.log(`[uniswap][wrap] confirmed: ${hash} — ${amountOut} WETH`);
      return { success: true, txHash: hash, amountOut };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error("[uniswap][wrap] failed:", error);
      return { success: false, error };
    }
  }

  // ─── DexScreener reference price (pattern from uniswap-ai swap-planner skill) ──

  /** Logs the current mainnet reference price from DexScreener (free, no key).
   *  Sepolia tokens have no real liquidity, so we look up the mainnet equivalent.
   *  Source: github.com/Uniswap/uniswap-ai — swap-planner skill */
  private async logDexScreenerPrice(tokenSymbol: string): Promise<void> {
    const tokenAddress = MAINNET_TOKENS[tokenSymbol.toUpperCase()];
    if (!tokenAddress) return;
    try {
      const url = `${this.dexScreenerBase}/token-pairs/v1/ethereum/${tokenAddress}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) return;
      const pairs = (await res.json()) as Array<{
        dexId: string;
        priceUsd?: string;
        liquidity?: { usd?: number };
        volume?: { h24?: number };
        baseToken: { symbol: string };
        quoteToken: { symbol: string };
      }>;
      const top = (Array.isArray(pairs) ? pairs : [])
        .filter((p) => p.dexId === "uniswap")
        .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
      if (!top) return;
      const price = top.priceUsd ? `$${parseFloat(top.priceUsd).toFixed(4)}` : "N/A";
      const liq = top.liquidity?.usd
        ? `$${(top.liquidity.usd / 1_000_000).toFixed(2)}M liquidity`
        : "liquidity unknown";
      const vol = top.volume?.h24
        ? `$${(top.volume.h24 / 1_000_000).toFixed(2)}M 24h vol`
        : "";
      console.log(
        `[uniswap][dexscreener] ${top.baseToken.symbol}/${top.quoteToken.symbol} (mainnet ref): ${price} | ${liq} | ${vol}`,
      );
    } catch {
      // non-critical — ignore failures
    }
  }

  // ─── Uniswap Trading API helpers ───────────────────────────────────────────

  private async fetchQuote(
    tokenIn: string,
    tokenOut: string,
    amount: string,
  ): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.apiBase}/quote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "x-universal-router-version": "2.0",
      },
      body: JSON.stringify({
        type: "EXACT_INPUT",
        tokenInChainId:  this.chainId,
        tokenOutChainId: this.chainId,
        tokenIn,
        tokenOut,
        amount,
        swapper:          this.walletAddress,
        routingPreference: "BEST_PRICE",
        protocols:        ["V3", "V2"],
        autoSlippage:     "DEFAULT",
        urgency:          "normal",
        generatePermitAsTransaction: false,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Uniswap /quote failed [${res.status}]: ${body}`);
    }
    return res.json() as Promise<Record<string, unknown>>;
  }

  private async checkApproval(
    token: string,
    amount: string,
    walletAddress: string,
  ): Promise<Record<string, unknown> | null> {
    const res = await fetch(`${this.apiBase}/check_approval`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": this.apiKey },
      body: JSON.stringify({ chainId: this.chainId, token, amount, walletAddress, urgency: "normal" }),
    });
    if (!res.ok) return null;
    return res.json() as Promise<Record<string, unknown>>;
  }

  private async fetchSwapTx(
    quote: unknown,
    permitData: unknown,
    signature?: string,
  ): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.apiBase}/swap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "x-universal-router-version": "2.0",
      },
      body: JSON.stringify({
        quote,
        permitData: permitData ?? null,  // must be null (not absent) when ETH is tokenIn
        signature,
        simulateTransaction: true,
        safetyMode: "SAFE",
        urgency: "normal",
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Uniswap /swap failed [${res.status}]: ${body}`);
    }
    return res.json() as Promise<Record<string, unknown>>;
  }

  /** Submit a UniswapX gasless order (DUTCH_V2 / DUTCH_V3 routing). */
  private async submitOrder(quote: unknown, signature?: string): Promise<void> {
    const res = await fetch(`${this.apiBase}/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": this.apiKey },
      body: JSON.stringify({ quote, signature }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Uniswap /order failed [${res.status}]: ${body}`);
    }
  }
}
