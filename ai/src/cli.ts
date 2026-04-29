import * as readline from "readline";
import { createAgent, HumanMessage } from "./agent.js";
import type { BaseMessage } from "@langchain/core/messages";

/** Runs an interactive CLI chat loop with the agent, maintaining message history. */
export async function runCli(): Promise<void> {
  const agent = createAgent();
  const history: BaseMessage[] = [];

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (prompt: string) =>
    new Promise<string>((resolve) => rl.question(prompt, resolve));

  console.log('Prediction market analyst ready. Type "exit" to quit.\n');

  while (true) {
    const input = await ask("You: ");
    if (input.trim().toLowerCase() === "exit") break;
    if (!input.trim()) continue;

    history.push(new HumanMessage(input));

    try {
      const result = await agent.invoke({ messages: history });
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
