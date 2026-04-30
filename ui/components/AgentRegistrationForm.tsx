"use client";

import { useCallback, useMemo, useState } from "react";
import { ConnectKitButton } from "connectkit";
import { waitForTransactionReceipt } from "viem/actions";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { sepolia } from "wagmi/chains";
import {
  AGENT_PROFILES,
  agenticSubdomainAbi,
  getRegistrarAddress,
  INTEREST_TOPICS,
  nameWrapperViewAbi,
  validateEnsLabel,
  type AgentProfile,
  type AgentProfileId,
} from "@/lib/agentic-registrar";

function readExpiryFromGetData(data: unknown): bigint | undefined {
  if (data == null) return undefined;
  if (Array.isArray(data) && data.length >= 3) {
    const v = data[2];
    return typeof v === "bigint" ? v : BigInt(String(v));
  }
  if (typeof data === "object" && data !== null && "expiry" in data) {
    const v = (data as { expiry: bigint | number | string }).expiry;
    return typeof v === "bigint" ? v : BigInt(String(v));
  }
  return undefined;
}

export function AgentRegistrationForm() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const registrar = useMemo(() => getRegistrarAddress(), []);

  const [interest, setInterest] = useState<string>(INTEREST_TOPICS[0].value);
  const [delegateEth, setDelegateEth] = useState("");
  const [selectedAgentId, setSelectedAgentId] =
    useState<AgentProfileId>("strategist");
  const [labelInput, setLabelInput] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: parentNode } = useReadContract({
    address: registrar,
    abi: agenticSubdomainAbi,
    functionName: "parentNode",
    chainId: sepolia.id,
  });

  const { data: nameWrapperAddress } = useReadContract({
    address: registrar,
    abi: agenticSubdomainAbi,
    functionName: "nameWrapper",
    chainId: sepolia.id,
  });

  const parentId =
    parentNode !== undefined
      ? BigInt(parentNode as `0x${string}`)
      : undefined;

  const { data: parentWrap, error: expiryError } = useReadContract({
    address: nameWrapperAddress,
    abi: nameWrapperViewAbi,
    functionName: "getData",
    args: parentId !== undefined ? [parentId] : undefined,
    chainId: sepolia.id,
    query: {
      enabled:
        Boolean(nameWrapperAddress) &&
        parentId !== undefined &&
        nameWrapperAddress !== "0x0000000000000000000000000000000000000000",
    },
  });

  const parentExpiry = readExpiryFromGetData(parentWrap);

  const { writeContractAsync } = useWriteContract();

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setStatusMsg(null);

      if (!isConnected || !address) {
        setStatusMsg("Connect your wallet first.");
        return;
      }

      if (chainId !== sepolia.id) {
        try {
          await switchChainAsync({ chainId: sepolia.id });
        } catch {
          setStatusMsg("Switch to the Sepolia network to register.");
          return;
        }
      }

      const labelErr = validateEnsLabel(labelInput);
      if (labelErr) {
        setStatusMsg(labelErr);
        return;
      }
      const label = labelInput.trim().toLowerCase();

      if (parentExpiry === undefined) {
        setStatusMsg(
          expiryError
            ? "Could not read parent expiry on Sepolia. Check your RPC."
            : "Loading parent expiry… try again in a moment.",
        );
        return;
      }

      setIsSubmitting(true);
      try {
        const expiry =
          parentExpiry > BigInt("18446744073709551615")
            ? BigInt("18446744073709551615")
            : parentExpiry;

        const hash = await writeContractAsync({
          address: registrar,
          abi: agenticSubdomainAbi,
          functionName: "setSubdomain",
          args: [label, address, expiry],
          chainId: sepolia.id,
        });
        const receipt = publicClient
          ? await waitForTransactionReceipt(publicClient, { hash })
          : null;
        if (receipt?.status === "success" || !publicClient) {
          setStatusMsg(
            publicClient
              ? `Confirmed. Subdomain « ${label}.agentic.eth » created (tx: ${hash.slice(0, 10)}…).`
              : `Transaction sent: ${hash.slice(0, 10)}… — check Sepolia explorer.`,
          );
        } else if (receipt) {
          setStatusMsg("The transaction failed on-chain.");
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Transaction cancelled or error.";
        setStatusMsg(msg);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      address,
      chainId,
      publicClient,
      expiryError,
      isConnected,
      labelInput,
      parentExpiry,
      registrar,
      switchChainAsync,
      writeContractAsync,
    ],
  );

  const selectedAgent = AGENT_PROFILES.find((a) => a.id === selectedAgentId);

  return (
    <div className="w-full max-w-xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Register your agent
        </h1>
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Connect your wallet, pick an area of interest, an amount to delegate,
          an agent profile, and the label that becomes{" "}
          <span className="font-mono text-zinc-800 dark:text-zinc-200">
            &lt;name&gt;.agentic.eth
          </span>
          . The transaction registers the subdomain on the Sepolia registrar
          contract.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <ConnectKitButton />
        {isConnected && address ? (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Connected — the subdomain will be assigned to this address.
          </span>
        ) : null}
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Area of interest
          </legend>
          <select
            value={interest}
            onChange={(e) => setInterest(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none ring-zinc-400/20 focus:border-emerald-500/60 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          >
            {INTEREST_TOPICS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Amount to delegate (ETH)
          </legend>
          <input
            type="text"
            inputMode="decimal"
            placeholder="e.g. 0.1"
            value={delegateEth}
            onChange={(e) => setDelegateEth(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900 shadow-sm outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            For your strategy only; not sent to the ENS contract below.
          </p>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Agent profile
          </legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {AGENT_PROFILES.map((agent: AgentProfile) => {
              const selected = agent.id === selectedAgentId;
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => setSelectedAgentId(agent.id)}
                  className={`rounded-xl border p-4 text-left transition-all ${
                    selected
                      ? "border-emerald-500 bg-emerald-50/90 ring-2 ring-emerald-500/30 dark:border-emerald-500/80 dark:bg-emerald-950/40 dark:ring-emerald-400/25"
                      : "border-zinc-200 bg-zinc-50/80 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900/50 dark:hover:border-zinc-600"
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                    {agent.shortTitle}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    {agent.title}
                  </p>
                  <p className="mt-2 text-xs leading-snug text-zinc-600 dark:text-zinc-400">
                    {agent.description}
                  </p>
                </button>
              );
            })}
          </div>
          {selectedAgent ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Focus: {selectedAgent.focus}
            </p>
          ) : null}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Agent name (ENS label)
          </legend>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              autoComplete="off"
              placeholder="myagent"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              className="min-w-[12rem] flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900 shadow-sm outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              .agentic.eth
            </span>
          </div>
        </fieldset>

        <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
          <p>
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              Contract (Sepolia):
            </span>{" "}
            <span className="font-mono break-all">{registrar}</span>
          </p>
          <p className="mt-1">
            Parent expiry from NameWrapper:{" "}
            {parentExpiry !== undefined
              ? parentExpiry.toString()
              : expiryError
                ? "error"
                : "…"}
          </p>
        </div>

        <button
          type="submit"
          disabled={
            !isConnected ||
            isSubmitting ||
            parentExpiry === undefined
          }
          className="inline-flex w-full items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {isSubmitting ? "Submitting…" : "Register on Sepolia"}
        </button>
      </form>

      {statusMsg ? (
        <p className="rounded-lg border border-zinc-200 bg-amber-50/90 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
          {statusMsg}
        </p>
      ) : null}
    </div>
  );
}
