"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ConnectKitButton } from "connectkit";
import { useAccount } from "wagmi";

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
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/90 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-zinc-50"
        >
          Predictive Intelligence
        </Link>

        <nav className="flex shrink-0 items-center gap-2 sm:gap-3">
          <ConnectKitButton />
          {isConnected ? (
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-1.5 rounded-full border border-zinc-200/90 bg-gradient-to-b from-white to-zinc-50 px-3 py-1.5 text-xs font-semibold tracking-tight text-zinc-800 shadow-sm ring-1 ring-black/[0.04] transition-all hover:border-emerald-500/45 hover:from-emerald-50/90 hover:to-white hover:text-emerald-950 hover:shadow-md hover:ring-emerald-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500/60 dark:border-zinc-700 dark:from-zinc-900 dark:to-zinc-950 dark:text-zinc-100 dark:ring-white/[0.06] dark:hover:border-emerald-500/50 dark:hover:from-emerald-950/50 dark:hover:to-zinc-900 dark:hover:text-emerald-100 sm:px-3.5 sm:py-2 sm:text-sm"
            >
              <span
                className="text-emerald-600 transition-colors group-hover:text-emerald-700 dark:text-emerald-400 dark:group-hover:text-emerald-300"
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
