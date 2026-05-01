"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { ConnectKitButtonClient } from "@/components/ConnectKitButtonClient";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useHasMounted } from "@/lib/useHasMounted";

type EthereumLike = {
  request: (args: {
    method: string;
    params?: unknown[];
  }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (
    event: string,
    handler: (...args: unknown[]) => void,
  ) => void;
};

function getEthereum(): EthereumLike | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { ethereum?: EthereumLike }).ethereum;
}

function shortenAddress(address: string, head = 6, tail = 4): string {
  if (address.length <= head + tail + 2) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}

export function AppHeader() {
  const hasMounted = useHasMounted();
  const { isConnected } = useAccount();
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const refreshAccounts = useCallback(async () => {
    const eth = getEthereum();
    if (!eth) return;
    try {
      const accounts = (await eth.request({
        method: "eth_accounts",
      })) as unknown;
      const first =
        Array.isArray(accounts) && typeof accounts[0] === "string"
          ? accounts[0]
          : null;
      setAddress(first);
    } catch {
      setAddress(null);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => refreshAccounts());

    const eth = getEthereum();
    if (!eth?.on) return;

    const onAccountsChanged = (accounts: unknown) => {
      const list = accounts as string[];
      setAddress(list?.[0] ?? null);
    };

    eth.on("accountsChanged", onAccountsChanged);
    return () => eth.removeListener?.("accountsChanged", onAccountsChanged);
  }, [refreshAccounts]);

  async function connectMetaMask() {
    setHint(null);
    const eth = getEthereum();
    if (!eth) {
      setHint(
        "MetaMask not found. Install the extension, then refresh the page.",
      );
      return;
    }
    setConnecting(true);
    try {
      await eth.request({ method: "eth_requestAccounts" });
      await refreshAccounts();
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Connection refused or cancelled.";
      setHint(msg);
    } finally {
      setConnecting(false);
    }
  }

  function disconnectUi() {
    setAddress(null);
    setHint(null);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="text-xl leading-none text-slate-900 transition-opacity hover:opacity-80 dark:text-slate-100"
          aria-label="Home — agents"
          title="Agentic execution & prediction"
        >
          <span aria-hidden>🤖</span>
        </Link>

        <nav className="flex shrink-0 items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <ConnectKitButtonClient />
          {hasMounted && isConnected ? (
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-slate-50/90 px-3 py-1.5 text-xs font-semibold tracking-tight text-slate-800 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-800 sm:px-3.5 sm:py-2 sm:text-sm"
            >
              <span
                className="text-slate-500 transition-colors group-hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200"
                aria-hidden
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                >
                  <path d="M3 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM12 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1V4zM3 12a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3zM12 12a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-3z" />
                </svg>
              </span>
              Dashboard
            </Link>
          ) : null}
        </nav>
      </div>
      {hint ? (
        <p className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100 sm:px-6">
          {hint}
        </p>
      ) : null}
    </header>
  );
}
