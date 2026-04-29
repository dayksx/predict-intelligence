import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { SystemMessage } from "@langchain/core/messages";
import type { AIMessage } from "@langchain/core/messages";
import { searchMarketsTool } from "../tools/searchMarkets.js";

const SYSTEM_PROMPT = `You are a prediction market analyst with access to a live knowledge graph 
of market data from Polymarket.

When a user asks about a market, asset, or trading opportunity:
1. Call search_markets once with a concise keyword query (e.g. "Bitcoin", "US election", "Fed rate")
2. If the first search returns nothing useful, try one alternative query — then stop
3. Analyse the returned facts — probabilities, volumes, resolution dates, relationships
4. Give a concise, data-grounded answer with your reasoning

Never call search_markets more than twice for the same question.
Be direct and analytical. If the graph has no data, say so clearly.`;

const tools = [searchMarketsTool];
const toolNode = new ToolNode(tools);

/** Creates and compiles the LangGraph ReAct-style agent. */
export function createAgent() {
  const llm = new ChatOpenAI({
    modelName: process.env.LITELLM_MODEL ?? "gpt-4o-mini",
    openAIApiKey: process.env.LITELLM_API_KEY,
    configuration: { baseURL: process.env.LITELLM_BASE_URL },
    temperature: 0.1,
  }).bindTools(tools);

  /** Node: calls the LLM — may produce tool calls or a final answer. */
  async function callModel(state: typeof MessagesAnnotation.State) {
    const messages = [new SystemMessage(SYSTEM_PROMPT), ...state.messages];
    const response = await llm.invoke(messages);
    return { messages: [response] };
  }

  /** Edge: route to tool node if the LLM called a tool, otherwise end. */
  function shouldContinue(state: typeof MessagesAnnotation.State) {
    const last = state.messages.at(-1) as AIMessage;
    return last.tool_calls?.length ? "tools" : END;
  }

  return new StateGraph(MessagesAnnotation)
    .addNode("agent", callModel)
    .addNode("tools", toolNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("tools", "agent")
    .compile();
}
