import express, { type Request, type Response, type NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import type { IWorkflowRunner } from "../../ports/inbound/IWorkflowRunner.js";

// ─── A2A types ────────────────────────────────────────────────────────────────

type TaskState = "submitted" | "working" | "completed" | "failed";

interface A2APart { text?: string; data?: unknown }
interface A2AMessage { role: "ROLE_USER" | "ROLE_AGENT"; parts: A2APart[]; messageId?: string }
interface A2ATask {
  id: string;
  status: { state: TaskState; message?: A2AMessage; timestamp: string };
  artifacts?: Array<{ name: string; parts: A2APart[] }>;
}
interface SendMessageRequest {
  message: A2AMessage;
  metadata?: { contextId?: string };
}

// ─── In-memory task store ─────────────────────────────────────────────────────

const tasks = new Map<string, A2ATask>();

// ─── Agent card ───────────────────────────────────────────────────────────────

function buildAgentCard(baseUrl: string) {
  return {
    name: "predict-intelligence-agent",
    description:
      "Analyses Polymarket prediction markets using a temporal knowledge graph " +
      "and answers trading questions with data-grounded reasoning.",
    url: baseUrl,
    version: "0.1.0",
    capabilities: { streaming: false, pushNotifications: false },
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["application/json"],
    skills: [
      {
        id: "market-analysis",
        name: "Prediction Market Analysis",
        description:
          "Searches the knowledge graph for market facts and returns a reasoned analysis.",
        tags: ["prediction-markets", "trading", "polymarket", "crypto"],
        examples: ["What are the current Bitcoin market probabilities?"],
      },
    ],
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } },
    security: [{ bearerAuth: [] }],
  };
}

// ─── Server factory ───────────────────────────────────────────────────────────

export function createA2AServer(workflow: IWorkflowRunner): express.Application {
  const app = express();
  app.use(express.json());

  const apiKey = process.env.WORKFLOW_API_KEY ?? "";
  const baseUrl = process.env.AGENT_BASE_URL ?? `http://localhost:${process.env.PORT ?? 4337}`;

  function requireAuth(req: Request, res: Response, next: NextFunction): void {
    if (!apiKey) { next(); return; }
    const token = (req.headers.authorization ?? "").replace("Bearer ", "");
    if (token !== apiKey) { res.status(401).json({ error: "Unauthorized" }); return; }
    next();
  }

  // GET /.well-known/agent-card.json
  app.get("/.well-known/agent-card.json", (_req, res) => {
    res.json(buildAgentCard(baseUrl));
  });

  // POST /message:send
  app.post("/message:send", requireAuth, (req: Request, res: Response) => {
    const body = req.body as SendMessageRequest;
    if (!body?.message?.parts?.length) {
      res.status(400).json({ error: "Missing message in request body" });
      return;
    }

    const query = body.message.parts.map((p) => p.text ?? "").join(" ").trim();
    // contextId is the ENS name sent by the UI in metadata (e.g. "ironman.agentic.eth")
    const contextId = body.metadata?.contextId ?? body.message.messageId ?? uuidv4();
    const taskId = uuidv4();
    const now = new Date().toISOString();

    const task: A2ATask = { id: taskId, status: { state: "submitted", timestamp: now } };
    tasks.set(taskId, task);

    // Return immediately — workflow runs asynchronously
    res.status(200).json(task);

    void runWorkflowAsync(taskId, workflow, { query, contextId });
  });

  // GET /tasks/:id
  app.get("/tasks/:id", requireAuth, (req: Request, res: Response) => {
    const task = tasks.get(String(req.params["id"] ?? ""));
    if (!task) { res.status(404).json({ error: "TaskNotFoundError" }); return; }
    res.json(task);
  });

  // GET /health
  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  return app;
}

// ─── Async workflow runner ────────────────────────────────────────────────────

async function runWorkflowAsync(
  taskId: string,
  workflow: IWorkflowRunner,
  options: { query: string; contextId: string }
): Promise<void> {
  const patch = (partial: Partial<A2ATask>) =>
    tasks.set(taskId, { ...tasks.get(taskId)!, ...partial });

  patch({ status: { state: "working", timestamp: new Date().toISOString() } });

  try {
    const result = await workflow.run(options);

    const artifacts: A2ATask["artifacts"] = [];
    if (result.decisions.length) {
      artifacts.push({ name: "decisions", parts: [{ data: result.decisions }] });
    }

    patch({
      status: {
        state: "completed",
        timestamp: new Date().toISOString(),
        message: { role: "ROLE_AGENT", parts: [{ text: result.response }] },
      },
      artifacts: artifacts.length ? artifacts : undefined,
    });

    console.log(`[a2a] task ${taskId} completed`);
  } catch (err) {
    patch({
      status: {
        state: "failed",
        timestamp: new Date().toISOString(),
        message: { role: "ROLE_AGENT", parts: [{ text: `Workflow failed: ${err}` }] },
      },
    });
    console.error(`[a2a] task ${taskId} failed:`, err);
  }
}
