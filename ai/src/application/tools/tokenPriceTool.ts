import { tool } from "@langchain/core/tools";
import { z } from "zod";

const DEXSCREENER_BASE = "https://api.dexscreener.com";

interface DexPair {
  dexId: string;
  chainId: string;
  priceUsd?: string;
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  baseToken: { symbol: string; address: string };
  quoteToken: { symbol: string; address: string };
  pairAddress: string;
}

/** Query DexScreener for live token price and pool liquidity data.
 *  Uses the free public API (no key required) following the pattern from
 *  github.com/Uniswap/uniswap-ai swap-planner skill. */
async function fetchTokenPairs(
  tokenAddress: string,
  network: string,
): Promise<DexPair[]> {
  const url = `${DEXSCREENER_BASE}/token-pairs/v1/${network}/${tokenAddress}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`DexScreener [${res.status}]: ${await res.text()}`);
  const data = (await res.json()) as DexPair[];
  return (Array.isArray(data) ? data : []).filter((p) => p.dexId === "uniswap");
}

/**
 * LangGraph tool: fetch live token price and Uniswap pool liquidity via DexScreener.
 * The agent uses this before a swap decision to confirm liquidity and estimate output.
 * Pattern sourced from github.com/Uniswap/uniswap-ai (swap-planner skill).
 */
export function makeTokenPriceTool() {
  return tool(
    async ({ tokenSymbol, network }) => {
      const net = network ?? "ethereum";

      // Resolve symbol → address for common tokens
      const WELL_KNOWN: Record<string, Record<string, string>> = {
        ethereum: {
          WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
          USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
          DAI:  "0x6B175474E89094C44Da98b954EedeAC495271d0F",
          WBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
          UNI:  "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
        },
        base: {
          WETH: "0x4200000000000000000000000000000000000006",
          USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        },
        arbitrum: {
          WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
          USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        },
      };

      const sym = tokenSymbol.toUpperCase();
      const tokenAddress = WELL_KNOWN[net]?.[sym];

      if (!tokenAddress) {
        return (
          `Unknown token "${tokenSymbol}" on network "${net}". ` +
          `Known tokens on ${net}: ${Object.keys(WELL_KNOWN[net] ?? {}).join(", ")}. ` +
          `Provide a raw 0x contract address instead.`
        );
      }

      try {
        const pairs = await fetchTokenPairs(tokenAddress, net);
        if (!pairs.length) {
          return `No Uniswap pools found for ${tokenSymbol} on ${net}. Liquidity may be too low.`;
        }

        const top = pairs
          .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))
          .slice(0, 3);

        const lines = top.map((p) => {
          const price = p.priceUsd ? `$${parseFloat(p.priceUsd).toFixed(4)}` : "N/A";
          const liq = p.liquidity?.usd
            ? `$${(p.liquidity.usd / 1_000).toFixed(1)}k liquidity`
            : "liquidity unknown";
          const vol = p.volume?.h24
            ? `$${(p.volume.h24 / 1_000).toFixed(1)}k 24h vol`
            : "";
          return `${p.baseToken.symbol}/${p.quoteToken.symbol}: ${price} | ${liq} | ${vol}`;
        });

        const best = top[0];
        const liquidityUsd = best?.liquidity?.usd ?? 0;
        const risk =
          liquidityUsd > 1_000_000
            ? "Low slippage risk"
            : liquidityUsd > 100_000
              ? "Medium slippage risk — monitor price impact"
              : "High slippage risk — consider smaller trade size";

        return [`${tokenSymbol} on ${net}:`, ...lines, "", `Risk: ${risk}`].join("\n");
      } catch (err) {
        return `DexScreener lookup failed for ${tokenSymbol}: ${err}`;
      }
    },
    {
      name: "get_token_price",
      description:
        "Fetch live token price and Uniswap pool liquidity from DexScreener before executing a swap. " +
        "Use this to check current price and liquidity depth before deciding on swap size. " +
        "Returns price in USD and pool liquidity for the top Uniswap pairs on the given network.",
      schema: z.object({
        tokenSymbol: z
          .string()
          .describe("Token symbol to look up, e.g. WETH, USDC, UNI"),
        network: z
          .string()
          .optional()
          .describe(
            'Network name: "ethereum", "base", "arbitrum", "optimism", "polygon". Defaults to "ethereum".',
          ),
      }),
    },
  );
}
