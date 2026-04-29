import "dotenv/config";
import { createA2AServer } from "./adapters/inbound/a2a.js";
import { WorkflowRunner } from "./adapters/inbound/WorkflowRunner.js";

const port = parseInt(process.env.PORT ?? "4337");
const app = createA2AServer(new WorkflowRunner());

app.listen(port, () => {
  console.log(`[a2a] server running at http://localhost:${port}`);
  console.log(`[a2a] agent card: http://localhost:${port}/.well-known/agent-card.json`);
  console.log(`[a2a] send message: POST http://localhost:${port}/message:send`);
  console.log(`[a2a] poll task:    GET  http://localhost:${port}/tasks/:id`);
});
