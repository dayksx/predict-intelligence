import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import type { AgentState } from "../agentState.js";
import { DecisionZ } from "../../domain/entities/decision.js";
import { buildSystemPrompt, buildUserMessage } from "../../domain/services/contextBuilderService.js";

const DecisionOutputZ = z.object({
  decisions: z.array(
    z.object({
      id: z.string().describe("Unique decision identifier e.g. d1, d2"),
      action: z
        .enum(["trade", "swap", "close_position", "hold_open", "hold"])
        .describe("Decision action type"),
      marketId: z.string().nullable().describe("Polymarket Gamma market ID, null if not applicable"),
      positionId: z.string().nullable().describe("Existing position ID for close/hold actions, null otherwise"),
      direction: z.enum(["YES", "NO"]).nullable().describe("Trade direction: YES or NO, null if not a trade"),
      sizeUsdc: z.number().nullable().describe("Position size in USDC, null if not applicable"),
      tokenIn: z.string().nullable().default(null).describe("Token to swap from, null if not a swap"),
      tokenOut: z.string().nullable().default(null).describe("Token to swap to, null if not a swap"),
      clobTokenId: z.string().nullable().default(null).describe("Polymarket CLOB token ID for the outcome, null if unknown"),
      negRisk: z.boolean().nullable().default(null).describe("true if the market uses the NegRiskAdapter, null if unknown"),
      yesPrice: z.number().nullable().default(null).describe("Current YES token price 0-1, null if unknown"),
      noPrice: z.number().nullable().default(null).describe("Current NO token price 0-1, null if unknown"),
      sell: z.boolean().nullable().default(null).describe("true to sell/close existing tokens, false to open new position, null if not a trade"),
      sources: z.array(z.string()).default([]).describe("Market fact UUIDs or labels that support this decision"),
      confidence: z.number().min(0).max(1).nullable().default(0.5).describe("Confidence score 0.0 to 1.0, null for close/hold actions"),
      reasoning: z.string().describe("One-line reasoning for this decision"),
    }),
  ),
});

/** Calls the LLM with structured output to produce a list of trading decisions.
 *  The system prompt is personalised from the user's TradingStrategy. */
export function makeReasonNode() {
  const llm = new ChatOpenAI({
    modelName: process.env.LITELLM_MODEL ?? "gpt-4o-mini",
    openAIApiKey: process.env.LITELLM_API_KEY,
    configuration: { baseURL: process.env.LITELLM_BASE_URL },
    temperature: 0.1,
  }).withStructuredOutput(DecisionOutputZ);

  return async function reasonNode(state: AgentState): Promise<Partial<AgentState>> {
    if (!state.strategy) throw new Error("reasonNode: strategy missing — ingestNode must run first");

    // Extract the user's original query (from chat/alpha) if present
    const userQuery = state.messages
      ?.filter((m) => m.getType() === "human")
      .map((m) => (typeof m.content === "string" ? m.content : ""))
      .filter(Boolean)
      .at(-1);

    const userMessage = buildUserMessage(state.openPositions, state.marketFacts);
    const fullUserMessage = userQuery
      ? `${userMessage}\n\n## User Signal\n${userQuery}`
      : userMessage;

    const result = await llm.invoke([
      new SystemMessage(buildSystemPrompt(state.strategy)),
      new HumanMessage(fullUserMessage),
    ]);

    return { decisions: result.decisions.map((d) => DecisionZ.parse(d)) };
  };
}
