import { parseAbi } from "viem";

/** Deployed Sepolia registrar — overridable via NEXT_PUBLIC_REGISTRAR_CONTRACT_ADDRESS */
export const DEFAULT_REGISTRAR_ADDRESS =
  "0x61067458871322Ed5438f8b93Ebb46368F9eeAc6" as const;

export function getRegistrarAddress(): `0x${string}` {
  const env = process.env.NEXT_PUBLIC_REGISTRAR_CONTRACT_ADDRESS;
  if (env && /^0x[a-fA-F0-9]{40}$/.test(env)) {
    return env as `0x${string}`;
  }
  return DEFAULT_REGISTRAR_ADDRESS;
}

export const agenticSubdomainAbi = parseAbi([
  "function setSubdomain(string label, address agentAddress, uint64 _expiry) external",
  "function nameWrapper() view returns (address)",
  "function parentNode() view returns (bytes32)",
  "function publicResolver() view returns (address)",
]);

export const nameWrapperViewAbi = parseAbi([
  "function getData(uint256 id) view returns (address owner, uint32 fuses, uint64 expiry)",
]);

/** Topics / domains of interest shown in the registration form */
export const INTEREST_TOPICS = [
  { value: "ethereum", label: "Ethereum" },
  { value: "bitcoin", label: "Bitcoin" },
  { value: "defi", label: "DeFi" },
  { value: "soccer", label: "Soccer" },
  { value: "basketball", label: "Basketball" },
  { value: "elections", label: "Elections" },
  { value: "rates", label: "Rates & macro" },
  { value: "nft", label: "NFT & culture" },
  { value: "ai", label: "AI & tech" },
  { value: "climate", label: "Climate & ESG" },
] as const;

export type InterestTopicValue = (typeof INTEREST_TOPICS)[number]["value"];

export type MarketplaceAgentId = "strategist" | "alpha" | "sports";

/** Listed agents users can subscribe to; each has its own access price (ETH). */
export type MarketplaceAgent = {
  id: MarketplaceAgentId;
  /** Product-style name */
  name: string;
  /** One-line specialty */
  tagline: string;
  description: string;
  /** Access fee in ETH (decimal string for display, e.g. "0.05") */
  accessPriceEth: string;
  /** Strategy capabilities surfaced on the contractor card */
  capabilities: readonly string[];
};

export const MARKETPLACE_AGENTS: readonly MarketplaceAgent[] = [
  {
    id: "strategist",
    name: "Geopolitic",
    tagline: "Geopolitical prediction markets",
    description:
      "Long and short views on geopolitical outcomes, with access to a dedicated geopolitical prediction market.",
    accessPriceEth: "0.001",
    capabilities: [
      "Long / Short markets",
      "Geopolitic Predictive Market",
    ],
  },
  {
    id: "alpha",
    name: "Crypto",
    tagline: "Crypto prediction markets",
    description:
      "Swap-related tooling alongside a crypto-focused predictive market for digital-asset theses.",
    accessPriceEth: "0.001",
    capabilities: ["Swap", "Crypto Predictive Market"],
  },
  {
    id: "sports",
    name: "Sport",
    tagline: "Sports prediction markets",
    description:
      "Sports-focused predictive markets for event-driven positioning and odds-style outcomes.",
    accessPriceEth: "0.001",
    capabilities: ["Sport Predictive Market"],
  },
] as const;

/** @deprecated Use MARKETPLACE_AGENTS */
export const AGENT_PROFILES = MARKETPLACE_AGENTS;

/** @deprecated Use MarketplaceAgentId */
export type AgentProfileId = MarketplaceAgentId;

/** @deprecated Use MarketplaceAgent */
export type AgentProfile = MarketplaceAgent;

const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function normalizeEnsLabel(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateEnsLabel(label: string): string | null {
  const n = normalizeEnsLabel(label);
  if (n.length < 3) return "Name must be at least 3 characters.";
  if (n.length > 63) return "Name cannot exceed 63 characters.";
  if (!LABEL_RE.test(n)) {
    return "Use only lowercase letters, digits, and hyphens (a-z, 0-9, -).";
  }
  return null;
}
