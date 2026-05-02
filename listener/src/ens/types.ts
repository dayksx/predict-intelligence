export type FocusDomain = "geopolitic" | "crypto" | "sport";

/** Raw ENS text records fetched from the resolver for an agentic.eth subdomain. */
export interface EnsTextRecords {
  focusDomain: FocusDomain;
  thesisPrompt: string;
  agentName: string;
  delegatedAmountEth: number;
}

/** A domain entry returned by the ENS Sepolia subgraph. */
export interface SubgraphDomain {
  id: string;          // namehash
  name: string;        // "alice.agentic.eth"
  labelName: string;   // "alice"
  owner: { id: string }; // wallet address (lowercase hex)
  createdAt: string;   // unix timestamp as string
}
