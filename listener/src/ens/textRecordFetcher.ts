import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import type { EnsTextRecords, FocusDomain } from "./types.js";

const VALID_DOMAINS: FocusDomain[] = ["geopolitic", "crypto", "sport"];

function isValidDomain(s: string | null | undefined): s is FocusDomain {
  return VALID_DOMAINS.includes(s as FocusDomain);
}

/**
 * Fetches the four agentic.eth text records from the ENS public resolver on Sepolia.
 * Returns null if focusDomain is missing or invalid — those records are required.
 */
export async function fetchTextRecords(ensName: string): Promise<EnsTextRecords | null> {
  const rpcUrl = process.env.SEPOLIA_RPC_URL ?? "https://rpc.sepolia.org";
  const client = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });

  const [focusDomain, thesisPrompt, agentName, delegatedAmount] = await Promise.all([
    client.getEnsText({ name: ensName, key: "agentic.focusDomain" }).catch(() => null),
    client.getEnsText({ name: ensName, key: "agentic.thesisPrompt" }).catch(() => null),
    client.getEnsText({ name: ensName, key: "agentic.agentName" }).catch(() => null),
    client.getEnsText({ name: ensName, key: "agentic.delegatedAmount" }).catch(() => null),
  ]);

  if (!isValidDomain(focusDomain)) {
    console.warn(`[ens] ${ensName}: invalid or missing focusDomain "${focusDomain}", skipping`);
    return null;
  }

  return {
    focusDomain,
    thesisPrompt: thesisPrompt ?? "",
    agentName: agentName ?? ensName,
    delegatedAmountEth: parseFloat(delegatedAmount ?? "0") || 0,
  };
}
