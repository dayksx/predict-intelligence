/** Mock data for the signed-in user dashboard (replace with API / wallet later). */

export type InterestDomain =
  | "geopolitic"
  | "crypto"
  | "soccer"
  | "energy";

export interface MockEnsIdentity {
  name: string;
  /** Checksummed-style display */
  address: string;
  avatarUrl: string | null;
  description: string;
  /** Simulated text records often shown in ENS profiles */
  records: { key: string; value: string }[];
}

export interface MockUserProfile {
  interests: InterestDomain[];
  macroTheses: string[];
}

export type AgentEngagementStatus = "active" | "paused" | "ending_soon";

export interface MockDelegatedAgent {
  id: string;
  displayName: string;
  domain: InterestDomain;
  /** e.g. research, execution, compliance */
  profileType: string;
  /** Short human label for the on-chain agreement */
  contractLabel: string;
  contractAddress: `0x${string}`;
  /** Assets the agent can operate (human-readable) */
  delegatedAssets: string;
  engagementStart: string;
  engagementEnd: string;
  serviceSummary: string;
  status: AgentEngagementStatus;
}

export const mockEnsIdentity: MockEnsIdentity = {
  name: "dayan.eth",
  address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
  avatarUrl: null,
  description:
    "Builder focused on prediction markets and agentic workflows. ETHGlobal Open Agents.",
  records: [
    { key: "url", value: "https://agentic.eth.limo" },
    { key: "com.twitter", value: "@dayanxyz" },
  ],
};

export const mockUserProfile: MockUserProfile = {
  interests: ["geopolitic", "crypto", "soccer", "energy"],
  macroTheses: [
    "Rates stay higher-for-longer until labor cracks; risk assets chop, not melt up.",
    "Ethereum L2 liquidity and intent-based settlement win short-term UX; watch sequencer decentralization.",
    "Geopolitical premium is mispriced into energy names during election windows.",
    "Soccer transfer windows = liquidity events for fan tokens and sponsorship narratives.",
  ],
};

export const mockDelegatedAgents: MockDelegatedAgent[] = [
  {
    id: "ag-crypto-1",
    displayName: "Agent Crypto",
    domain: "crypto",
    profileType: "Execution & settlement",
    contractLabel: "Service agreement v2",
    contractAddress: "0x4a2b8c1d9e0f3a2b6c7d8e9f0a1b2c3d4e5f6a7b",
    delegatedAssets: "2.5 ETH · 12,400 USDC",
    engagementStart: "2025-11-14",
    engagementEnd: "2026-11-14",
    serviceSummary:
      "Market making prep, Uniswap routes, and treasury normalization to USDC for agent runs.",
    status: "active",
  },
  {
    id: "ag-geo-1",
    displayName: "Agent Geopolitic",
    domain: "geopolitic",
    profileType: "Research & OSINT digest",
    contractLabel: "Delegate mandate",
    contractAddress: "0x7c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d",
    delegatedAssets: "4,200 USDC",
    engagementStart: "2025-09-01",
    engagementEnd: "2026-03-01",
    serviceSummary:
      "Daily regime-risk brief, election catalysts, and prediction-market mapping vs news flow.",
    status: "active",
  },
  {
    id: "ag-energy-1",
    displayName: "Agent Energy",
    domain: "energy",
    profileType: "Macro & commodities",
    contractLabel: "Hedging agent scope",
    contractAddress: "0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1",
    delegatedAssets: "1.1 ETH",
    engagementStart: "2025-12-01",
    engagementEnd: "2026-06-30",
    serviceSummary:
      "Crack spreads, inventory surprises, and policy shocks folded into thesis updates.",
    status: "ending_soon",
  },
  {
    id: "ag-soccer-1",
    displayName: "Agent Soccer",
    domain: "soccer",
    profileType: "Odds & narrative layer",
    contractLabel: "Sports signal subscription",
    contractAddress: "0x9e8d7c6b5a4938271605f4e3d2c1b0a9f8e7d6c5b",
    delegatedAssets: "800 USDC",
    engagementStart: "2026-01-10",
    engagementEnd: "2026-07-10",
    serviceSummary:
      "Injury/squad signals, xG context, and market-specific mispricing alerts.",
    status: "paused",
  },
];

const domainLabels: Record<InterestDomain, string> = {
  geopolitic: "Geopolitic",
  crypto: "Crypto",
  soccer: "Soccer",
  energy: "Energy",
};

export function formatDomain(domain: InterestDomain): string {
  return domainLabels[domain];
}

export function shortAddress(address: string, chars = 4): string {
  if (address.length <= 2 + chars * 2) return address;
  return `${address.slice(0, 2 + chars)}…${address.slice(-chars)}`;
}
