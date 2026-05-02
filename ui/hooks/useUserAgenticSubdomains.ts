"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchUserAgenticSubdomains } from "@/lib/fetch-user-agentic-subdomains";

export function useUserAgenticSubdomains(address: `0x${string}` | undefined) {
  return useQuery({
    queryKey: ["ens", "agentic-subdomains", address],
    queryFn: ({ signal }) => {
      if (!address) throw new Error("No wallet address");
      return fetchUserAgenticSubdomains(address, { signal });
    },
    enabled: Boolean(address),
  });
}
