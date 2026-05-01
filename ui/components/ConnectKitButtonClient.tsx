"use client";

import { ConnectKitButton } from "connectkit";
import { useHasMounted } from "@/lib/useHasMounted";

/**
 * ConnectKit renders differently once wallets/extensions are available; defer to
 * post-hydration to avoid React #418 hydration attribute mismatches.
 */
export function ConnectKitButtonClient() {
  const mounted = useHasMounted();
  if (!mounted) {
    return (
      <div
        className="inline-flex h-10 min-w-[8.25rem] items-center justify-center rounded-lg border border-slate-200 bg-slate-50/90 text-[11px] font-medium text-transparent dark:border-slate-700 dark:bg-slate-900/50"
        aria-hidden
      />
    );
  }
  return <ConnectKitButton />;
}
