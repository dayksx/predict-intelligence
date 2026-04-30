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

export type AgentProfileId = "strategist" | "alpha" | "sports";

export type AgentProfile = {
  id: AgentProfileId;
  title: string;
  shortTitle: string;
  description: string;
  focus: string;
};

/** Three selectable agent personas (UX); on-chain owner remains the connected wallet */
export const AGENT_PROFILES: readonly AgentProfile[] = [
  {
    id: "strategist",
    title: "Geopolitical analyst",
    shortTitle: "Geopolitics",
    description:
      "Macro scenarios, country risk, and political events to inform market views.",
    focus: "Geopolitics & macro",
  },
  {
    id: "alpha",
    title: "Crypto strategist",
    shortTitle: "Crypto",
    description:
      "On-chain flow, narrative, and timing for opportunity-oriented execution.",
    focus: "Crypto & on-chain",
  },
  {
    id: "sports",
    title: "Sports & data expert",
    shortTitle: "Sports",
    description:
      "Form, stats, and schedule for actionable signals across sports markets.",
    focus: "Sports & probability",
  },
] as const;

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
