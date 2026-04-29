import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const SYSTEM_PROMPT = `You are a prediction market analyst. You help users reason about 
market probabilities, geopolitical events, and trading opportunities. Be concise and analytical.`;

/** Creates and compiles the LangGraph agent. */
export function createAgent() {
  const llm = new ChatOpenAI({
    modelName: process.env.LITELLM_MODEL ?? "gpt-4o-mini",
    openAIApiKey: process.env.LITELLM_API_KEY,
    configuration: {
      baseURL: process.env.LITELLM_BASE_URL,
    },
    temperature: 0.2,
  });

  /** Single node: calls the LLM with the full message history. */
  async function callModel(state: typeof MessagesAnnotation.State) {
    const messages = [new SystemMessage(SYSTEM_PROMPT), ...state.messages];
    const response = await llm.invoke(messages);
    return { messages: [response] };
  }

  const graph = new StateGraph(MessagesAnnotation)
    .addNode("agent", callModel)
    .addEdge("__start__", "agent")
    .addEdge("agent", "__end__")
    .compile();

  return graph;
}

export { HumanMessage };
