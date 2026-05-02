"use client";

import { AgentChatPanel } from "@/components/agent/AgentChatPanel";
import { AgentLiveConsole } from "@/components/agent/AgentLiveConsole";
import { useAgentLiveFeed } from "@/hooks/useAgentLiveFeed";
import type { LivePhase } from "@/lib/agent-live-messages";

/** Full-width band: wide chat + live console — placed at top of the agent page for a direct connection to the agent. */
export function AgentLiveSidebar({ label }: { label: string }) {
  const { lines, pushLine } = useAgentLiveFeed(label);

  const onAgentActivity = (phase: LivePhase, message: string) => {
    pushLine({ phase, message });
  };

  return (
    <section
      aria-label="Agent conversation and live activity"
      className="w-full rounded-xl border border-sky-200/80 bg-gradient-to-br from-sky-50/90 via-white to-zinc-50/80 p-3 dark:border-sky-800/50 dark:from-sky-950/25 dark:via-zinc-950 dark:to-zinc-950 sm:p-4"
    >
      <div className="grid w-full gap-3 md:gap-4 lg:grid-cols-12 lg:items-start">
        <div className="order-2 lg:order-1 lg:col-span-5 xl:col-span-4">
          <AgentLiveConsole lines={lines} />
        </div>
        <div className="order-1 lg:order-2 lg:col-span-7 xl:col-span-8">
          <AgentChatPanel label={label} onActivity={onAgentActivity} />
        </div>
      </div>
    </section>
  );
}
