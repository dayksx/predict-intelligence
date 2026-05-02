import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import type { EnsTextRecords, FocusDomain, AgentProfileId } from "./types.js";

/** Maps any free-text focusDomain value (from ENS) to an internal FocusDomain. */
function normaliseFocusDomain(raw: string | null | undefined): FocusDomain {
  const s = (raw ?? "").toLowerCase();
  if (/soccer|basketball|sport|football|nba|nfl|mlb/.test(s)) return "sport";
  if (/ethereum|bitcoin|defi|nft|crypto|ai|tech|web3|token/.test(s)) return "crypto";
  return "geopolitic";
}

/**
 * Derives the marketplace agent ID from the stored display name.
 * UI stores: "Geopolitic" → "strategist", "Crypto" → "alpha", "Sport" → "sports".
 */
function agentIdFromName(name: string | null | undefined): AgentProfileId | null {
  const s = (name ?? "").toLowerCase();
  if (s.includes("crypto")) return "alpha";
  if (s.includes("sport")) return "sports";
  if (s.includes("geopolitic") || s.includes("strategist")) return "strategist";
  return null;
}

/**
 * Fetches all agentic.eth text records from the ENS public resolver on Sepolia.
 * Returns null only if ALL records are absent (metadata not yet published).
 */
export async function fetchTextRecords(ensName: string): Promise<EnsTextRecords | null> {
  const rpcUrl = process.env.SEPOLIA_RPC_URL ?? "https://rpc.sepolia.org";
  const client = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });

  const [focusDomainRaw, thesisPrompt, agentName, delegatedAmount] = await Promise.all([
    client.getEnsText({ name: ensName, key: "agentic.focusDomain" }).catch(() => null),
    client.getEnsText({ name: ensName, key: "agentic.thesisPrompt" }).catch(() => null),
    client.getEnsText({ name: ensName, key: "agentic.agentName" }).catch(() => null),
    client.getEnsText({ name: ensName, key: "agentic.delegatedAmount" }).catch(() => null),
  ]);

  if (!focusDomainRaw && !thesisPrompt && !agentName && !delegatedAmount) {
    console.warn(`[ens] ${ensName}: all text records null — metadata not yet published`);
    return null;
  }

  const focusDomain = normaliseFocusDomain(focusDomainRaw);
  const agentId = agentIdFromName(agentName);

  if (focusDomainRaw && focusDomain !== focusDomainRaw.toLowerCase()) {
    console.log(`[ens] ${ensName}: mapped focusDomain "${focusDomainRaw}" → "${focusDomain}"`);
  }
  if (agentName && !agentId) {
    console.warn(`[ens] ${ensName}: could not derive agentId from agentName "${agentName}" — using default`);
  }

  return {
    focusDomain,
    thesisPrompt: thesisPrompt ?? "",
    agentName: agentName ?? ensName,
    agentId,
    delegatedAmountEth: parseFloat(delegatedAmount ?? "0") || 0,
  };
}
