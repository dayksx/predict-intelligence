import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  mode?: "chat" | "alpha";
  message?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function pollA2ATask(
  baseUrl: string,
  taskId: string,
  headers: HeadersInit,
): Promise<{ reply: string; rawState?: string }> {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/tasks/${taskId}`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Task poll failed: ${res.status} ${t}`);
    }
    const task = (await res.json()) as {
      status?: { state?: string; message?: { parts?: { text?: string }[] } };
    };
    const state = task.status?.state;
    if (state === "completed") {
      const text =
        task.status?.message?.parts?.map((p) => p.text ?? "").join("") ??
        "(empty reply)";
      return { reply: text.trim() || "(empty reply)", rawState: state };
    }
    if (state === "failed") {
      const err =
        task.status?.message?.parts?.map((p) => p.text ?? "").join("") ??
        "failed";
      throw new Error(err);
    }
    await sleep(450);
  }
  throw new Error("Timed out waiting for agent reply.");
}

async function sendChatToAgent(
  message: string,
  contextId?: string,
): Promise<{
  reply: string;
  taskId?: string;
  source: "a2a" | "mock";
}> {
  const baseUrl =
    process.env.AGENT_A2A_URL ?? process.env.AI_SERVICE_URL ?? "";
  const apiKey = process.env.WORKFLOW_API_KEY ?? "";

  if (!baseUrl) {
    return {
      reply:
        `[demo] Agent API not configured (set AGENT_A2A_URL). You said: "${message.slice(0, 400)}${message.length > 400 ? "…" : ""}"`,
      source: "mock",
    };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const sendRes = await fetch(`${baseUrl.replace(/\/$/, "")}/message:send`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      message: {
        role: "ROLE_USER",
        parts: [{ text: message }],
      },
      ...(contextId ? { metadata: { contextId } } : {}),
    }),
  });

  if (!sendRes.ok) {
    const t = await sendRes.text();
    throw new Error(`Agent send failed: ${sendRes.status} ${t}`);
  }

  const submitted = (await sendRes.json()) as { id?: string };
  const taskId = submitted.id;
  if (!taskId) throw new Error("Agent did not return a task id.");

  const { reply } = await pollA2ATask(baseUrl, taskId, headers);
  return { reply, taskId, source: "a2a" };
}

async function ingestAlphaToGraphiti(
  label: string,
  content: string,
): Promise<{ ok: boolean; detail: string }> {
  const graphitiUrl = process.env.GRAPHITI_URL ?? "";
  const groupId = process.env.GRAPHITI_GROUP_ID ?? "predict";

  if (!graphitiUrl) {
    return {
      ok: true,
      detail:
        "GRAPHITI_URL not set — alpha logged locally for UI only. Configure Graphiti to persist episodes.",
    };
  }

  const res = await fetch(`${graphitiUrl.replace(/\/$/, "")}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      group_id: groupId,
      messages: [
        {
          name: `user_alpha_${label}_${Date.now()}`,
          content,
          role_type: "user",
          role: "dashboard_alpha",
          timestamp: new Date().toISOString(),
          source_description: `User-supplied alpha from dashboard · agent ${label}.agentic.eth`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    return { ok: false, detail: `Graphiti: ${res.status} ${t}` };
  }

  return {
    ok: true,
    detail: "Queued for the knowledge graph — entities will be extracted async.",
  };
}

export async function POST(
  req: Request,
  context: { params: Promise<{ label: string }> },
) {
  const { label } = await context.params;
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const mode = body.mode ?? "chat";
  const message = (body.message ?? "").trim();
  if (!message) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  try {
    if (mode === "alpha") {
      const ensName = `${label}.agentic.eth`;
      // 1. Enrich knowledge graph with user's alpha insight
      const ingested = await ingestAlphaToGraphiti(label, message);
      // 2. Immediately trigger the AI workflow with this alpha as human context
      let agentReply: string | undefined;
      try {
        const alphaPrompt = `[Alpha signal from user] ${message}`;
        const chat = await sendChatToAgent(alphaPrompt, ensName);
        agentReply = chat.reply;
      } catch {
        // non-fatal — alpha was already ingested to Graphiti
      }
      return NextResponse.json({
        ok: ingested.ok,
        mode: "alpha",
        detail: ingested.detail,
        reply: agentReply,
      });
    }

    const chat = await sendChatToAgent(message, `${label}.agentic.eth`);
    return NextResponse.json({
      ok: true,
      mode: "chat",
      reply: chat.reply,
      taskId: chat.taskId,
      source: chat.source,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
