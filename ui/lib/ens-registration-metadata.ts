import { encodeFunctionData, namehash, parseAbi } from "viem";
import {
  INTEREST_TOPICS,
  type InterestTopicValue,
  type MarketplaceAgent,
} from "@/lib/agentic-registrar";

/** Sepolia Public Resolver — matches AgenticSubdomain deployment. */
export const ENS_PUBLIC_RESOLVER_ABI = parseAbi([
  "function setText(bytes32 node, string key, string value) external",
  "function multicall(bytes[] data) external returns (bytes[])",
]);

/**
 * ENS `setText` keys for Agentic registration metadata.
 *
 * Uses a dotted vendor prefix (`agentic.*`) plus camelCase tails so keys stay
 * readable and avoid collisions with reserved/global ENS text records (ENSIP-5),
 * following the same idea as ecosystem keys like `com.twitter` / `org.telegram`.
 *
 * Logical fields: focusDomain, thesisPrompt, agentName, delegatedAmount.
 */
export const AGENTIC_ENS_TEXT_KEYS = {
  focusDomain: "agentic.focusDomain",
  thesisPrompt: "agentic.thesisPrompt",
  agentName: "agentic.agentName",
  delegatedAmount: "agentic.delegatedAmount",
} as const;

export type AgenticRegistrationMetadataInput = {
  topicValues: readonly InterestTopicValue[];
  thesisPrompt: string;
  agent: MarketplaceAgent;
  /** Delegation intent as a decimal ETH string; may be empty when omitted. */
  delegationEthIntent: string;
};

/** Human-readable focus domains (comma-separated topic labels). */
function formatFocusDomain(values: readonly InterestTopicValue[]): string {
  return values
    .map(
      (v) => INTEREST_TOPICS.find((t) => t.value === v)?.label ?? String(v),
    )
    .join(", ");
}

/** Builds exactly four text records for the public resolver multicall. */
export function buildAgenticRegistrationTextRecords(
  input: AgenticRegistrationMetadataInput,
): { key: string; value: string }[] {
  return [
    {
      key: AGENTIC_ENS_TEXT_KEYS.focusDomain,
      value: formatFocusDomain(input.topicValues),
    },
    {
      key: AGENTIC_ENS_TEXT_KEYS.thesisPrompt,
      value: input.thesisPrompt.trim(),
    },
    {
      key: AGENTIC_ENS_TEXT_KEYS.agentName,
      value: input.agent.name,
    },
    {
      key: AGENTIC_ENS_TEXT_KEYS.delegatedAmount,
      value: input.delegationEthIntent.trim(),
    },
  ];
}

export function encodeSetTextMulticallPayload(
  fullName: string,
  pairs: readonly { key: string; value: string }[],
): `0x${string}`[] {
  const node = namehash(fullName);
  return pairs.map(({ key, value }) =>
    encodeFunctionData({
      abi: ENS_PUBLIC_RESOLVER_ABI,
      functionName: "setText",
      args: [node, key, value],
    }),
  );
}
