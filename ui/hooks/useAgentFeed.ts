"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchPercieve,
  fetchReason,
  fetchAct,
  fetchProfile,
  isApiConfigured,
} from "@/lib/api-client";

const ENABLED = isApiConfigured();

export function usePercieve() {
  return useQuery({
    queryKey: ["perceive"],
    queryFn: fetchPercieve,
    enabled: ENABLED,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useReason(label: string) {
  return useQuery({
    queryKey: ["reason", label],
    queryFn: () => fetchReason(label),
    enabled: ENABLED && label.length > 0,
    staleTime: 5_000,
    refetchInterval: 15_000,
    retry: 1,
  });
}

export function useAct(label: string) {
  return useQuery({
    queryKey: ["act", label],
    queryFn: () => fetchAct(label),
    enabled: ENABLED && label.length > 0,
    staleTime: 5_000,
    refetchInterval: 15_000,
    retry: 1,
  });
}

export function useProfile(label: string) {
  return useQuery({
    queryKey: ["profile", label],
    queryFn: () => fetchProfile(label),
    enabled: ENABLED && label.length > 0,
    staleTime: 5_000,
    refetchInterval: (query) =>
      query.state.data?.status === "registered" ? 60_000 : 10_000,
    retry: 1,
  });
}
