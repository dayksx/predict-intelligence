"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  nextSyntheticLine,
  type LiveFeedLine,
} from "@/lib/agent-live-messages";

const MAX_LINES = 48;
const TICK_MS = 5200;

function sessionStartLine(agentLabel: string): LiveFeedLine {
  return {
    id: `session-${agentLabel}-${Date.now()}`,
    phase: "system",
    message: `Session started for ${agentLabel} — live feed is running.`,
    at: new Date().toISOString(),
  };
}

export function useAgentLiveFeed(agentLabel: string) {
  const [lines, setLines] = useState<LiveFeedLine[]>(() => [
    sessionStartLine(agentLabel),
  ]);
  const tickRef = useRef(0);

  const pushLine = useCallback((line: Omit<LiveFeedLine, "id" | "at"> & { id?: string; at?: string }) => {
    const entry: LiveFeedLine = {
      id: line.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      phase: line.phase,
      message: line.message,
      at: line.at ?? new Date().toISOString(),
    };
    setLines((prev) => [entry, ...prev].slice(0, MAX_LINES));
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      tickRef.current += 1;
      const line = nextSyntheticLine(agentLabel, tickRef.current);
      pushLine(line);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [agentLabel, pushLine]);

  return { lines, pushLine };
}
