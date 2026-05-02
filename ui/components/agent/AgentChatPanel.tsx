"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { LivePhase } from "@/lib/agent-live-messages";

type ChatMode = "chat" | "alpha";

export function AgentChatPanel({
  label,
  onActivity,
}: {
  label: string;
  onActivity: (phase: LivePhase, message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<ChatMode>("chat");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<
    { role: "user" | "assistant" | "system"; text: string; at: string }[]
  >([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || pending) return;

    setError(null);
    setPending(true);
    const at = new Date().toISOString();
    setMessages((m) => [...m, { role: "user", text, at }]);
    setInput("");

    if (mode === "chat") {
      onActivity(
        "act",
        `You sent a chat message — requesting agent reply…`,
      );
    } else {
      onActivity(
        "reason",
        `Queuing your alpha for the knowledge graph…`,
      );
    }

    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(label)}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, message: text }),
      });
      const data = (await res.json()) as Record<string, unknown>;

      if (!res.ok) {
        const err =
          typeof data.error === "string"
            ? data.error
            : `Request failed (${res.status})`;
        throw new Error(err);
      }

      if (mode === "alpha") {
        const detail =
          typeof data.detail === "string"
            ? data.detail
            : "Alpha submitted.";
        setMessages((m) => [
          ...m,
          { role: "assistant", text: detail, at: new Date().toISOString() },
        ]);
        onActivity("system", detail);

        // Show agent reply if the workflow also ran
        if (typeof data.reply === "string" && data.reply) {
          setMessages((m) => [
            ...m,
            { role: "assistant", text: data.reply as string, at: new Date().toISOString() },
          ]);
          onActivity("act", "Agent analysed your alpha — check Act table for positions.");
        }
      } else {
      const reply =
        typeof data.reply === "string"
          ? data.reply
          : JSON.stringify(data);
      const source =
        data.source === "a2a"
          ? " (live agent)"
          : data.source === "mock"
            ? " (demo — configure AGENT_A2A_URL)"
            : "";

      const noDecisions = reply.toLowerCase().includes("no actionable decisions");

      if (!noDecisions) {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            text: `${reply}${source}`,
            at: new Date().toISOString(),
          },
        ]);
        onActivity("reason", "Agent reply received — see conversation below.");
      } else {
        onActivity("system", `No trade taken — market conditions didn't meet your confidence threshold.`);
      }
      }

      // Refresh Reason / Act tables so new entries appear immediately
      void queryClient.invalidateQueries({ queryKey: ["reason", label] });
      void queryClient.invalidateQueries({ queryKey: ["act", label] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Request failed";
      setError(msg);
      onActivity("system", `Error: ${msg}`);
    } finally {
      setPending(false);
    }
  }, [input, label, mode, onActivity, pending]);

  return (
    <section
      aria-labelledby="agent-chat-heading"
      className="rounded-lg border border-sky-200/90 bg-sky-50/70 p-3 dark:border-sky-800/55 dark:bg-sky-950/30"
    >
      <h2
        id="agent-chat-heading"
        className="text-sm font-semibold text-sky-950 dark:text-sky-100"
      >
        Talk to your agent
      </h2>
      <p className="mt-1 text-[11px] leading-snug text-sky-800/85 dark:text-sky-300/90">
        Chat uses your workflow when{" "}
        <span className="font-mono text-[10px] text-sky-900 dark:text-sky-400">
          AGENT_A2A_URL
        </span>{" "}
        is set; Add alpha uses Graphiti when{" "}
        <span className="font-mono text-[10px] text-violet-900 dark:text-violet-400">
          GRAPHITI_URL
        </span>{" "}
        is set.
      </p>

      <div className="mt-3 flex rounded-lg border border-sky-200/80 bg-white/90 p-0.5 dark:border-sky-900/50 dark:bg-zinc-950/90">
        <button
          type="button"
          onClick={() => setMode("chat")}
          className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
            mode === "chat"
              ? "bg-sky-600 text-white shadow-sm dark:bg-sky-500 dark:text-white"
              : "text-sky-800/70 hover:bg-sky-50 hover:text-sky-950 dark:text-sky-400/80 dark:hover:bg-sky-950/50 dark:hover:text-sky-100"
          }`}
        >
          Chat
        </button>
        <button
          type="button"
          onClick={() => setMode("alpha")}
          className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
            mode === "alpha"
              ? "bg-violet-600 text-white shadow-sm dark:bg-violet-500 dark:text-white"
              : "text-violet-900/70 hover:bg-violet-50 hover:text-violet-950 dark:text-violet-300/80 dark:hover:bg-violet-950/40 dark:hover:text-violet-100"
          }`}
        >
          Add alpha
        </button>
      </div>

      {messages.length === 0 ? (
        <p className="mt-3 text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500">
          {mode === "chat"
            ? "Ask a question or tell the agent what to analyze — replies appear here once you send."
            : "Paste facts, links, or thesis notes below — confirmations appear here after you submit."}
        </p>
      ) : (
        <div className="mt-3 max-h-36 space-y-2 overflow-y-auto rounded-md border border-sky-100 bg-white px-2.5 py-2 dark:border-sky-900/40 dark:bg-zinc-950/70">
          {messages.map((msg, i) => (
            <div
              key={`${msg.at}-${i}`}
              className={`rounded-md border-l-[3px] py-0.5 pl-2 text-xs leading-snug ${
                msg.role === "user"
                  ? "border-sky-400 text-zinc-900 dark:border-sky-500 dark:text-zinc-100"
                  : msg.role === "assistant"
                    ? "border-violet-400 text-zinc-700 dark:border-violet-500 dark:text-zinc-300"
                    : "border-amber-400 text-amber-900 dark:border-amber-500 dark:text-amber-200"
              }`}
            >
              <span
                className={`text-[10px] font-medium uppercase tracking-wide ${
                  msg.role === "user"
                    ? "text-sky-600 dark:text-sky-400"
                    : msg.role === "assistant"
                      ? "text-violet-600 dark:text-violet-400"
                      : "text-amber-700 dark:text-amber-400"
                }`}
              >
                {msg.role === "user" ? "You" : msg.role === "assistant" ? "Agent / graph" : "System"}
              </span>
              <p className="mt-0.5 whitespace-pre-wrap">{msg.text}</p>
            </div>
          ))}
        </div>
      )}

      {error ? (
        <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}

      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1">
          <span className="sr-only">
            {mode === "chat" ? "Message" : "Alpha content"}
          </span>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            placeholder={
              mode === "chat"
                ? "Ask something or give a task…"
                : "Paste intel or notes…"
            }
            className="w-full resize-none rounded-md border border-sky-200 bg-white px-2.5 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-400/25 dark:border-sky-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-sky-500 dark:focus:ring-sky-500/20"
          />
        </label>
        <button
          type="button"
          onClick={() => void send()}
          disabled={pending || !input.trim()}
          className="shrink-0 rounded-md bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-sky-500 dark:hover:bg-sky-400"
        >
          {pending ? "Sending…" : mode === "chat" ? "Send" : "Submit alpha"}
        </button>
      </div>
    </section>
  );
}
