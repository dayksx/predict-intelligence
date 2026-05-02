"use client";

import { phaseLabel, type LiveFeedLine } from "@/lib/agent-live-messages";

function phaseClass(phase: LiveFeedLine["phase"]): string {
  switch (phase) {
    case "perceive":
      return "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200";
    case "reason":
      return "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-200";
    case "act":
      return "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-200";
    default:
      return "border-zinc-200 bg-zinc-100 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-200";
  }
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function AgentLiveConsole({ lines }: { lines: LiveFeedLine[] }) {
  return (
    <section
      aria-labelledby="live-console-heading"
      className="flex max-h-52 flex-col overflow-hidden rounded-lg border border-emerald-800/70 bg-zinc-950 text-zinc-100 shadow-[inset_0_1px_0_0_rgba(52,211,153,0.12)] dark:border-emerald-900/80 sm:max-h-56"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-emerald-900/50 bg-emerald-950/45 px-3 py-2">
        <div>
          <h2
            id="live-console-heading"
            className="text-xs font-semibold tracking-tight text-emerald-100"
          >
            Live activity
          </h2>
          <p className="text-[10px] text-emerald-400/80">
            Sample ticks until real telemetry streams.
          </p>
        </div>
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
        </span>
      </div>
      <div
        className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-2 py-2 font-mono text-[10px] leading-snug"
        role="log"
        aria-live="polite"
      >
        {lines.length === 0 ? (
          <p className="px-1 text-zinc-500">Waiting for first tick…</p>
        ) : (
          lines.map((line) => (
            <div
              key={line.id}
              className="rounded border border-zinc-800/80 bg-zinc-900/60 px-2 py-1.5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${phaseClass(line.phase)}`}
                >
                  {phaseLabel(line.phase)}
                </span>
                <span className="text-zinc-500" suppressHydrationWarning>{formatTime(line.at)}</span>
              </div>
              <p className="mt-1.5 text-zinc-200">{line.message}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
