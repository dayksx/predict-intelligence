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

/** Custom ENS text keys (vendor-style dotted namespace). */
export const AGENTIC_ENS_TEXT_KEYS = {
  schema: "agentic.registration.schema",
  nameLabel: "agentic.name.label",
  nameFull: "agentic.name.full",
  focusTopicIds: "agentic.focus.topicIds",
  focusTopicLabels: "agentic.focus.topicLabels",
  thesisPrompt: "agentic.thesis.prompt",
  agentId: "agentic.agent.id",
  agentName: "agentic.agent.name",
  agentTagline: "agentic.agent.tagline",
  agentAccessEth: "agentic.agent.accessEth",
  delegateIntentEth: "agentic.delegate.intentEth",
} as const;

export type AgenticRegistrationMetadataInput = {
  /** Normalized label only (no `.agentic.eth`). */
  label: string;
  topicValues: readonly InterestTopicValue[];
  thesisPrompt: string;
  agent: MarketplaceAgent;
  delegationEthIntent: string;
};

function topicLabels(values: readonly InterestTopicValue[]): string {
  return values
    .map(
      (v) => INTEREST_TOPICS.find((t) => t.value === v)?.label ?? String(v),
    )
    .join(", ");
}

export function buildAgenticRegistrationTextRecords(
  input: AgenticRegistrationMetadataInput,
): { key: string; value: string }[] {
  const topicIds = input.topicValues.join(",");
  const labels = topicLabels(input.topicValues);

  const full = `${input.label}.agentic.eth`;

  return [
    { key: AGENTIC_ENS_TEXT_KEYS.schema, value: "agentic-registration-v1" },
    { key: AGENTIC_ENS_TEXT_KEYS.nameLabel, value: input.label },
    { key: AGENTIC_ENS_TEXT_KEYS.nameFull, value: full },
    { key: AGENTIC_ENS_TEXT_KEYS.focusTopicIds, value: topicIds },
    { key: AGENTIC_ENS_TEXT_KEYS.focusTopicLabels, value: labels },
    {
      key: AGENTIC_ENS_TEXT_KEYS.thesisPrompt,
      value: input.thesisPrompt.trim(),
    },
    { key: AGENTIC_ENS_TEXT_KEYS.agentId, value: input.agent.id },
    { key: AGENTIC_ENS_TEXT_KEYS.agentName, value: input.agent.name },
    { key: AGENTIC_ENS_TEXT_KEYS.agentTagline, value: input.agent.tagline },
    {
      key: AGENTIC_ENS_TEXT_KEYS.agentAccessEth,
      value: input.agent.accessPriceEth,
    },
    {
      key: AGENTIC_ENS_TEXT_KEYS.delegateIntentEth,
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
