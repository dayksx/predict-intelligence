import * as readline from "readline";
import { HumanMessage } from "@langchain/core/messages";
import type { BaseMessage, AIMessage } from "@langchain/core/messages";
import { createAgent } from "./agent/graph.js";

/** CLI primary adapter — reads user input and streams agent responses. */
export async function runCli(): Promise<void> {
  const agent = createAgent();
  const history: BaseMessage[] = [];

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (prompt: string) => new Promise<string>((resolve) => rl.question(prompt, resolve));

  console.log("Prediction market analyst ready. (Graphiti knowledge graph connected)");
  console.log('Type your question or "exit" to quit.\n');

  while (true) {
    const input = await ask("You: ");
    if (input.trim().toLowerCase() === "exit") break;
    if (!input.trim()) continue;

    history.push(new HumanMessage(input));

    try {
      const result = await agent.invoke(
        { messages: history },
        { recursionLimit: 6 },  // max 3 search → analyse cycles
      );

      // Show unique tool calls so the user can see what was fetched
      const seenQueries = new Set<string>();
      for (const msg of result.messages as BaseMessage[]) {
        const ai = msg as AIMessage;
        if (ai.tool_calls?.length) {
          for (const tc of ai.tool_calls) {
            if (!seenQueries.has(tc.args.query)) {
              seenQueries.add(tc.args.query);
              console.log(`\n[searching graph: "${tc.args.query}"]`);
            }
          }
        }
      }

      const last = result.messages.at(-1);
      const reply = typeof last?.content === "string" ? last.content : JSON.stringify(last?.content);
      console.log(`\nAgent: ${reply}\n`);

      // Keep full history for multi-turn context
      history.length = 0;
      history.push(...result.messages);
    } catch (err) {
      console.error("Error:", err);
    }
  }

  rl.close();
}
