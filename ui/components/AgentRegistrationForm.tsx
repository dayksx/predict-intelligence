"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { namehash } from "viem/ens";
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
  AGENTIC_ENS_TEXT_KEYS,
  buildAgenticRegistrationTextRecords,
  encodeSetTextMulticallPayload,
  ENS_PUBLIC_RESOLVER_ABI,
} from "@/lib/ens-registration-metadata";
import {
  MARKETPLACE_AGENTS,
  agenticSubdomainAbi,
  getRegistrarAddress,
  INTEREST_TOPICS,
  nameWrapperViewAbi,
  normalizeEnsLabel,
  validateEnsLabel,
  type InterestTopicValue,
  type MarketplaceAgent,
  type MarketplaceAgentId,
} from "@/lib/agentic-registrar";
import { useHasMounted } from "@/lib/useHasMounted";

function shortenAddress(addr: string, head = 6, tail = 4): string {
  if (addr.length <= head + tail + 2) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

function shortenTxHash(hash: string, head = 10, tail = 8): string {
  if (hash.length <= head + tail + 1) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

type SignatureStepVariant = "idle" | "active" | "done" | "warn";

function signatureStepCardClass(variant: SignatureStepVariant): string {
  const base =
    "rounded-lg border px-3 py-2.5 text-left transition-colors duration-200";
  switch (variant) {
    case "active":
      return `${base} border-sky-400/85 bg-sky-50/95 text-sky-950 shadow-sm ring-1 ring-sky-300/45 dark:border-sky-600 dark:bg-sky-950/45 dark:text-sky-50 dark:ring-sky-700/45`;
    case "done":
      return `${base} border-emerald-300/70 bg-emerald-50/75 text-emerald-950 dark:border-emerald-800/45 dark:bg-emerald-950/30 dark:text-emerald-100`;
    case "warn":
      return `${base} border-amber-300/75 bg-amber-50/85 text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100`;
    default:
      return `${base} border-slate-200/65 bg-white/50 text-slate-500 dark:border-slate-700/70 dark:bg-slate-950/40 dark:text-slate-400`;
  }
}

/** Sepolia L2/sidechain explorer — canonical public txs view */
function sepoliaEtherscanTxUrl(hash: string): string {
  return `https://sepolia.etherscan.io/tx/${hash}`;
}

/** ENS Manager on Sepolia — name & text records */
function ensSepoliaAppNameUrl(fullName: string): string {
  return `https://sepolia.app.ens.domains/${encodeURIComponent(fullName)}`;
}

/** ENS Explorer (alpha) — protocol-level name lookup */
function ensExplorerNameUrl(fullName: string): string {
  return `https://explorer.ens.dev/name/${encodeURIComponent(fullName)}`;
}

type RegistrationStatus =
  | null
  | { type: "error"; message: string }
  | {
      type: "success";
      fullName: string;
      subdomainTx: `0x${string}`;
      metadataTx?: `0x${string}`;
      metadataFailedNote?: string;
    };

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

const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as `0x${string}`;

function readOwnerFromGetData(data: unknown): `0x${string}` | undefined {
  if (data == null) return undefined;
  if (Array.isArray(data) && data.length >= 1) {
    const o = data[0];
    if (typeof o === "string" && o.startsWith("0x")) return o as `0x${string}`;
  }
  if (typeof data === "object" && data !== null && "owner" in data) {
    const o = (data as { owner: unknown }).owner;
    if (typeof o === "string" && o.startsWith("0x")) return o as `0x${string}`;
  }
  return undefined;
}

function isZeroAddress(addr: `0x${string}`): boolean {
  return addr.toLowerCase() === ZERO_ADDRESS.toLowerCase();
}

/** Empty string is valid (optional field). */
function validateDelegationEth(raw: string): string | null {
  const t = raw.trim();
  if (t === "") return null;
  if (!/^\d*\.?\d+$/.test(t) || Number.isNaN(Number(t))) {
    return "Enter a valid ETH amount (e.g. 0.25).";
  }
  const n = Number(t);
  if (n <= 0) return "Delegation amount must be greater than zero.";
  if (n > 1_000_000) return "Amount seems unreasonably large.";
  return null;
}

function contractorInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2 && parts[0]?.[0] && parts[1]?.[0]) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/** Primary label for individual controls (compact, uppercase). */
function FieldLabel({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-[11px] font-semibold tracking-[0.08em] text-sky-950/55 uppercase dark:text-sky-200/70"
    >
      {children}
    </label>
  );
}

/** Step / section title — matches breadcrumb wording, sentence case. */
function SectionTitle({
  children,
  as: Tag = "h2",
  step,
}: {
  children: React.ReactNode;
  as?: "h2" | "h3";
  /** 1-based step index shown in a compact badge */
  step?: number;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-start gap-3 border-b border-slate-200/85 pb-3.5 dark:border-slate-700/75">
        {step != null ? (
          <span
            className="mt-0.5 flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-lg bg-sky-100/95 text-sm font-semibold tabular-nums text-sky-900 shadow-sm ring-1 ring-sky-200/50 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-800/50"
            aria-hidden
          >
            {step}
          </span>
        ) : null}
        <Tag className="min-w-0 flex-1 text-lg font-semibold leading-snug tracking-tight text-slate-900 sm:text-[1.25rem] sm:leading-tight dark:text-slate-50">
          {children}
        </Tag>
      </div>
    </div>
  );
}

function HelperText({
  children,
  id,
  className = "",
  discrete = false,
  quiet = false,
}: {
  children: React.ReactNode;
  id?: string;
  className?: string;
  /** Smaller, lower-contrast copy for section intros */
  discrete?: boolean;
  /** Fine print — subtler than `discrete` for hints beside controls */
  quiet?: boolean;
}) {
  const tone = quiet
    ? "text-[9px] font-normal leading-snug text-slate-400/85 dark:text-slate-500 sm:text-[10px]"
    : discrete
      ? "text-[10px] font-normal leading-snug text-slate-500/75 dark:text-slate-500 sm:text-[11px]"
      : "text-xs leading-relaxed text-slate-600 dark:text-slate-400";
  return (
    <p id={id} className={`${tone} ${className}`}>
      {children}
    </p>
  );
}

const formCardClass =
  "rounded-xl border border-slate-200/80 bg-gradient-to-br from-white via-sky-50/20 to-white p-5 shadow-sm shadow-slate-900/[0.05] ring-1 ring-slate-100/80 dark:border-slate-800 dark:from-slate-950 dark:via-slate-950 dark:to-sky-950/20 dark:shadow-lg dark:shadow-black/25 dark:ring-slate-800/40 sm:p-6";

const ORANGE_CAPABILITY_PILL_CLASS =
  "border-orange-200/80 bg-orange-50 text-orange-950 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-200";

/** GitHub-style label tints (aligned with dashboard `statusPresentation` pills) */
const CAPABILITY_PILL_CLASSES = [
  "border-emerald-200/80 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/55 dark:text-emerald-200",
  "border-sky-200/80 bg-sky-50 text-sky-950 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
  "border-violet-200/80 bg-violet-50 text-violet-950 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-200",
  "border-amber-200/80 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  "border-rose-200/80 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200",
  "border-cyan-200/80 bg-cyan-50 text-cyan-950 dark:border-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-200",
  "border-fuchsia-200/80 bg-fuchsia-50 text-fuchsia-950 dark:border-fuchsia-800 dark:bg-fuchsia-950/50 dark:text-fuchsia-200",
  ORANGE_CAPABILITY_PILL_CLASS,
] as const;

function capabilityPillClass(cap: string, index: number): string {
  if (cap.trim().toLowerCase() === "sport predictive market") {
    return ORANGE_CAPABILITY_PILL_CLASS;
  }
  return CAPABILITY_PILL_CLASSES[index % CAPABILITY_PILL_CLASSES.length];
}

function interestTopicPillClass(value: InterestTopicValue): string {
  const idx = INTEREST_TOPICS.findIndex((t) => t.value === value);
  const i = idx === -1 ? 0 : idx;
  return CAPABILITY_PILL_CLASSES[i % CAPABILITY_PILL_CLASSES.length];
}

function FormStepCard({
  id,
  className = "",
  children,
}: {
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      className={`scroll-mt-28 transition-shadow duration-200 ${formCardClass} ${className}`}
    >
      {children}
    </div>
  );
}

/** Full titles inside each form section card */
const REGISTRATION_SECTION_LABELS = {
  claim: "Claim your agent's name",
  agent: "Choose your agent's profile",
  delegate: "Amount to delegate",
  focus: "Define your agent's prompt",
  register: "Register on-chain",
} as const;

/** Short labels for the header breadcrumb only */
const REGISTRATION_NAV_LABELS = {
  claim: "Claim name",
  agent: "Choose profile",
  focus: "Define prompt",
  delegate: "Amount to delegate",
  register: "Register on-chain",
} as const;

const REGISTRATION_STEPS = [
  { id: "step-claim", label: REGISTRATION_NAV_LABELS.claim },
  { id: "step-agent", label: REGISTRATION_NAV_LABELS.agent },
  { id: "step-focus", label: REGISTRATION_NAV_LABELS.focus },
  { id: "step-delegate", label: REGISTRATION_NAV_LABELS.delegate },
  { id: "step-register", label: REGISTRATION_NAV_LABELS.register },
] as const;

type RegistrationStepId = (typeof REGISTRATION_STEPS)[number]["id"];

/** Breadcrumb / step links aligned with form sections */
function RegistrationStepsNav({
  navClassName = "border-b border-slate-100 bg-slate-50/90 px-6 py-3 dark:border-slate-800 dark:bg-slate-900/40",
}: {
  navClassName?: string;
}) {
  const [activeId, setActiveId] = useState<RegistrationStepId>("step-claim");

  useEffect(() => {
    const headerReserve = 72;

    function updateActive() {
      let current: RegistrationStepId = "step-claim";
      for (const { id } of REGISTRATION_STEPS) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top <= headerReserve) current = id;
      }
      setActiveId(current);
    }

    updateActive();
    window.addEventListener("scroll", updateActive, { passive: true });
    window.addEventListener("resize", updateActive, { passive: true });
    return () => {
      window.removeEventListener("scroll", updateActive);
      window.removeEventListener("resize", updateActive);
    };
  }, []);

  return (
    <nav aria-label="Registration steps" className={navClassName}>
      <ol className="flex list-none flex-wrap items-center gap-x-1 gap-y-2 pl-0 text-[11px] font-medium">
        {REGISTRATION_STEPS.map((step, i) => {
          const isActive = activeId === step.id;
          return (
            <li key={step.id} className="flex items-center gap-x-1">
              {i > 0 ? (
                <span
                  className="mx-0.5 select-none text-sky-300/70 dark:text-sky-700/60"
                  aria-hidden
                >
                  &gt;
                </span>
              ) : null}
              <a
                href={`#${step.id}`}
                className={`rounded-md px-1.5 py-1 leading-tight transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400/70 ${
                  isActive
                    ? "bg-sky-100/80 text-sky-950 dark:bg-sky-950/35 dark:text-sky-100"
                    : "text-slate-500 hover:text-sky-900 dark:text-slate-500 dark:hover:text-sky-200"
                }`}
                aria-current={isActive ? "step" : undefined}
              >
                {step.label}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function AgentRegistrationForm() {
  const hasMounted = useHasMounted();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const registrar = useMemo(() => getRegistrarAddress(), []);

  const [selectedInterests, setSelectedInterests] = useState<
    InterestTopicValue[]
  >([]);
  const [selectedAgentId, setSelectedAgentId] =
    useState<MarketplaceAgentId>("strategist");
  const [labelInput, setLabelInput] = useState("");
  const [thesisPrompt, setThesisPrompt] = useState("");
  const [delegationEth, setDelegationEth] = useState("");
  const [registrationStatus, setRegistrationStatus] =
    useState<RegistrationStatus>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  /** Which wallet signature is in progress: 1 = subdomain, 2 = resolver metadata */
  const [signingStep, setSigningStep] = useState<0 | 1 | 2>(0);
  const [debouncedLabel, setDebouncedLabel] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (registrationStatus?.type !== "success") return;
    const id = window.setTimeout(() => {
      router.push("/dashboard");
    }, 1600);
    return () => window.clearTimeout(id);
  }, [registrationStatus, router]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedLabel(labelInput), 400);
    return () => clearTimeout(t);
  }, [labelInput]);

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

  const normalizedAvailabilityLabel = useMemo(() => {
    const err = validateEnsLabel(debouncedLabel);
    if (err) return undefined;
    return normalizeEnsLabel(debouncedLabel);
  }, [debouncedLabel]);

  const childNameTokenId = useMemo(() => {
    if (!normalizedAvailabilityLabel) return undefined;
    return BigInt(
      namehash(`${normalizedAvailabilityLabel}.agentic.eth`),
    );
  }, [normalizedAvailabilityLabel]);

  const {
    data: childWrap,
    isFetching: isChildAvailabilityFetching,
    isError: isChildAvailabilityError,
  } = useReadContract({
    address: nameWrapperAddress,
    abi: nameWrapperViewAbi,
    functionName: "getData",
    args: childNameTokenId !== undefined ? [childNameTokenId] : undefined,
    chainId: sepolia.id,
    query: {
      enabled:
        Boolean(
          nameWrapperAddress &&
            nameWrapperAddress !== ZERO_ADDRESS &&
            childNameTokenId !== undefined,
        ),
    },
  });

  const childOwner = readOwnerFromGetData(childWrap);

  const inputAlignedWithDebouncedAvailability =
    normalizeEnsLabel(labelInput) === normalizedAvailabilityLabel &&
    normalizedAvailabilityLabel !== undefined;

  const isEnsNameTaken =
    inputAlignedWithDebouncedAvailability &&
    childOwner !== undefined &&
    !isZeroAddress(childOwner);

  const isEnsNameAvailable =
    inputAlignedWithDebouncedAvailability &&
    childOwner !== undefined &&
    isZeroAddress(childOwner);

  const showAvailabilityChecking =
    Boolean(normalizedAvailabilityLabel) &&
    (!inputAlignedWithDebouncedAvailability || isChildAvailabilityFetching);

  const { writeContractAsync } = useWriteContract();

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setRegistrationStatus(null);
      setSigningStep(0);

      if (!isConnected || !address) {
        setRegistrationStatus({
          type: "error",
          message: "Connect your wallet first.",
        });
        return;
      }

      if (chainId !== sepolia.id) {
        try {
          await switchChainAsync({ chainId: sepolia.id });
        } catch {
          setRegistrationStatus({
            type: "error",
            message: "Switch to the Sepolia network to register.",
          });
          return;
        }
      }

      const labelErr = validateEnsLabel(labelInput);
      if (labelErr) {
        setRegistrationStatus({ type: "error", message: labelErr });
        return;
      }
      const delegErr = validateDelegationEth(delegationEth);
      if (delegErr) {
        setRegistrationStatus({ type: "error", message: delegErr });
        return;
      }
      const label = labelInput.trim().toLowerCase();

      if (parentExpiry === undefined) {
        setRegistrationStatus({
          type: "error",
          message: expiryError
            ? "Could not read parent expiry on Sepolia. Check your RPC."
            : "Loading parent expiry… try again in a moment.",
        });
        return;
      }

      if (publicClient && nameWrapperAddress) {
        try {
          const tokenId = BigInt(namehash(`${label}.agentic.eth`));
          const check = await publicClient.readContract({
            address: nameWrapperAddress,
            abi: nameWrapperViewAbi,
            functionName: "getData",
            args: [tokenId],
          });
          const owner = readOwnerFromGetData(check);
          if (owner !== undefined && !isZeroAddress(owner)) {
            setRegistrationStatus({
              type: "error",
              message: "This name is already registered on ENS.",
            });
            return;
          }
        } catch {
          // getData can revert; let the user try on-chain or retry.
        }
      }

      setIsSubmitting(true);
      setSigningStep(1);
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
          const fullName = `${label}.agentic.eth` as const;

          // Notify the API of the selected agent profile immediately after step 1,
          // so the listener can read the agentId from the API when it processes the ENS event.
          const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
          if (apiUrl) {
            const selectedAgent = MARKETPLACE_AGENTS.find((a) => a.id === selectedAgentId);
            fetch(`${apiUrl}/ingest/profiles`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ensName: fullName,
                status: "pending",
                agentId: selectedAgentId,
                profile: { agentId: selectedAgentId, agentName: selectedAgent?.name ?? selectedAgentId },
              }),
            }).catch(() => {/* non-blocking — best effort */});
          }
          let metadataTx: `0x${string}` | undefined;
          let metadataFailedNote: string | undefined;

          if (publicClient && receipt?.status === "success") {
            const agent = MARKETPLACE_AGENTS.find((a) => a.id === selectedAgentId);
            if (agent) {
              try {
                setSigningStep(2);
                const resolver = await publicClient.readContract({
                  address: registrar,
                  abi: agenticSubdomainAbi,
                  functionName: "publicResolver",
                });
                const pairs = buildAgenticRegistrationTextRecords({
                  topicValues: selectedInterests,
                  thesisPrompt,
                  agent,
                  delegationEthIntent: delegationEth.trim(),
                });
                const calldatas = encodeSetTextMulticallPayload(
                  fullName,
                  pairs,
                );
                const metaHash = await writeContractAsync({
                  address: resolver,
                  abi: ENS_PUBLIC_RESOLVER_ABI,
                  functionName: "multicall",
                  args: [calldatas as readonly `0x${string}`[]],
                  chainId: sepolia.id,
                });
                metadataTx = metaHash;
              } catch (metaErr) {
                const hint =
                  metaErr instanceof Error ? metaErr.message : "Unknown error";
                metadataFailedNote = `Metadata was not written: ${hint}`;
              }
            } else {
              metadataFailedNote =
                "ENS metadata skipped (no matching agent profile).";
            }
          }

          setRegistrationStatus({
            type: "success",
            fullName,
            subdomainTx: hash,
            metadataTx,
            metadataFailedNote,
          });
        } else if (receipt) {
          setRegistrationStatus({
            type: "error",
            message: "The transaction failed on-chain.",
          });
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Transaction cancelled or error.";
        setRegistrationStatus({ type: "error", message: msg });
      } finally {
        setIsSubmitting(false);
        setSigningStep(0);
      }
    },
    [
      address,
      chainId,
      publicClient,
      expiryError,
      isConnected,
      delegationEth,
      labelInput,
      parentExpiry,
      registrar,
      selectedAgentId,
      selectedInterests,
      thesisPrompt,
      switchChainAsync,
      writeContractAsync,
      nameWrapperAddress,
    ],
  );

  const selectedAgent = MARKETPLACE_AGENTS.find((a) => a.id === selectedAgentId);

  const inputBase =
    "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2.5 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500/85 focus:ring-0 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-400/80";

  const submitDisabled =
    !hasMounted ||
    !isConnected ||
    isSubmitting ||
    parentExpiry === undefined ||
    isEnsNameTaken;

  const submitDisabledTitle = (() => {
    if (!submitDisabled) return undefined;
    if (!hasMounted) return "Loading wallet interface…";
    if (!isConnected) return "Connect your wallet to register.";
    if (parentExpiry === undefined) return "Loading contract data from Sepolia…";
    if (isSubmitting) return "Waiting for wallet confirmation.";
    if (isEnsNameTaken) return "This name is already taken.";
    return undefined;
  })();

  const liveLabelFormatError =
    labelInput.trim() === "" ? null : validateEnsLabel(labelInput);

  const availabilityStatusId = "ens-label-availability";

  const signatureStepVariants = useMemo(() => {
    const success = registrationStatus?.type === "success";
    const ok =
      registrationStatus?.type === "success" ? registrationStatus : null;

    const step1Done = Boolean(success || (isSubmitting && signingStep === 2));
    const step1Active = isSubmitting && signingStep === 1;
    let step1: SignatureStepVariant = "idle";
    if (step1Active) step1 = "active";
    else if (step1Done) step1 = "done";

    const metaOk = Boolean(ok?.metadataTx);
    const metaWarn = Boolean(ok?.metadataFailedNote && !ok?.metadataTx);
    const step2Active = isSubmitting && signingStep === 2;
    let step2: SignatureStepVariant = "idle";
    if (metaWarn) step2 = "warn";
    else if (metaOk) step2 = "done";
    else if (step2Active) step2 = "active";

    return { step1, step2 };
  }, [registrationStatus, isSubmitting, signingStep]);

  return (
    <div className="w-full max-w-4xl">
      <article className="overflow-hidden rounded-2xl border border-sky-100/60 bg-white dark:border-sky-950/35 dark:bg-slate-950">
        <header className="border-b border-sky-100/50 bg-gradient-to-r from-sky-50/35 via-white to-white dark:border-slate-800 dark:from-slate-900 dark:via-slate-950 dark:to-slate-950">
          <h1 className="sr-only">Registration</h1>
          <div className="flex flex-col gap-3 px-6 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <RegistrationStepsNav navClassName="min-w-0 flex-1 border-0 bg-transparent p-0 dark:bg-transparent" />
            <div className="flex shrink-0 flex-col items-stretch justify-center sm:items-end">
              {!hasMounted ? (
                <p className="text-right text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Connect to continue
                </p>
              ) : isConnected && address ? (
                <p className="text-[11px] text-right whitespace-nowrap">
                  <span className="font-medium text-sky-950/55 dark:text-sky-200/65">
                    Owner:{" "}
                  </span>
                  <span className="font-mono font-semibold tabular-nums text-sky-950 dark:text-sky-100">
                    {shortenAddress(address)}
                  </span>
                </p>
              ) : (
                <p className="text-right text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Connect to continue
                </p>
              )}
            </div>
          </div>
        </header>

        <form onSubmit={onSubmit} className="px-6 py-8">
          <div className="space-y-10">
            <FormStepCard id="step-claim">
              <fieldset className="min-w-0 space-y-3 border-0 p-0">
              <legend className="sr-only">
                {REGISTRATION_SECTION_LABELS.claim}
              </legend>
              <SectionTitle step={1}>
                {REGISTRATION_SECTION_LABELS.claim}
              </SectionTitle>
              <HelperText discrete>
                This is your public handle under{" "}
                <span className="font-mono font-medium text-sky-700/70 dark:text-sky-400/75">
                  .agentic.eth
                </span>
                — make it yours before someone else does.
              </HelperText>
              <FieldLabel htmlFor="ens-label">Your handle</FieldLabel>
              <div className="flex min-w-0 max-w-md flex-wrap items-center gap-2 sm:flex-nowrap">
                <input
                  id="ens-label"
                  name="ensLabel"
                  type="text"
                  autoComplete="off"
                  placeholder="e.g. sharp-alpha"
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  aria-describedby={`ens-label-rules ${availabilityStatusId}`}
                  className={`${inputBase} min-w-0 flex-1 sm:min-w-[12rem]`}
                />
                <span className="shrink-0 font-mono text-sm font-semibold text-sky-700/80 tabular-nums dark:text-sky-400/85">
                  .agentic.eth
                </span>
              </div>
              <p
                id="ens-label-rules"
                className="mt-1.5 max-w-md text-[10px] leading-snug font-normal text-slate-400/75 dark:text-slate-500/80"
              >
                3–63 chars: lowercase letters, digits, hyphens only.
              </p>
              <p
                id={availabilityStatusId}
                role="status"
                aria-live="polite"
                className="mt-1.5 max-w-md text-[11px] leading-snug"
              >
                {labelInput.trim() === "" ? null : liveLabelFormatError ? (
                  <span className="text-amber-800/90 dark:text-amber-200/90">
                    {liveLabelFormatError}
                  </span>
                ) : showAvailabilityChecking ? (
                  <span className="text-slate-500 dark:text-slate-400">
                    Checking availability on Sepolia…
                  </span>
                ) : isChildAvailabilityError ? (
                  <span className="text-slate-500 dark:text-slate-500">
                    Couldn’t verify on-chain. You can still try, or refresh and
                    check your RPC.
                  </span>
                ) : isEnsNameTaken ? (
                  <span className="font-medium text-amber-800 dark:text-amber-200/95">
                    Already taken — pick another name.
                  </span>
                ) : isEnsNameAvailable ? (
                  <span className="font-medium text-emerald-800/90 dark:text-emerald-300/90">
                    Available
                  </span>
                ) : null}
              </p>
              </fieldset>
            </FormStepCard>

            {/* Agents */}
            <FormStepCard id="step-agent">
              <fieldset className="min-w-0 space-y-4 border-0 p-0">
              <legend className="sr-only">
                {REGISTRATION_SECTION_LABELS.agent}
              </legend>
              <SectionTitle step={2}>
                {REGISTRATION_SECTION_LABELS.agent}
              </SectionTitle>
              <HelperText discrete className="max-w-2xl">
                Pick the operator that fits how you think—fee shown in ETH. Your
                choice ships with the metadata step, not the name claim.
              </HelperText>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {MARKETPLACE_AGENTS.map((agent: MarketplaceAgent) => {
                  const selected = agent.id === selectedAgentId;
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => setSelectedAgentId(agent.id)}
                      aria-pressed={selected}
                      className={`flex flex-col rounded-xl border p-5 text-left transition-colors ${
                        selected
                          ? "border-sky-300/70 bg-sky-50/55 dark:border-sky-600/45 dark:bg-sky-950/22"
                          : "border-sky-100/70 bg-white hover:border-sky-200/90 hover:bg-sky-50/35 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-sky-900/50 dark:hover:bg-slate-900/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 gap-3">
                          <span
                            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold tracking-tight ${
                              selected
                                ? "bg-sky-700 text-white dark:bg-sky-500 dark:text-slate-950"
                                : "bg-sky-100/90 text-sky-950 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                            aria-hidden
                          >
                            {contractorInitials(agent.name)}
                          </span>
                          <div className="min-w-0">
                            <span className="block truncate text-base font-semibold text-slate-900 dark:text-slate-50">
                              {agent.name}
                            </span>
                            <span className="mt-0.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                              {agent.tagline}
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0 rounded-lg border border-sky-100/80 bg-sky-50/55 px-2.5 py-1.5 text-right dark:border-sky-900/40 dark:bg-sky-950/30">
                          <span className="block font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                            {agent.accessPriceEth}
                          </span>
                          <span className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                            ETH access
                          </span>
                        </div>
                      </div>
                      <p className="mt-4 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                        {agent.description}
                      </p>
                      <div className="mt-4 border-t border-sky-100/70 pt-4 dark:border-slate-800">
                        <p className="text-[10px] font-semibold tracking-[0.12em] text-sky-800/65 uppercase dark:text-sky-300/55">
                          Capabilities
                        </p>
                        <ul className="mt-2.5 flex flex-wrap gap-1.5">
                          {agent.capabilities.slice(0, 3).map((cap, i) => (
                            <li
                              key={cap}
                              className={`rounded-md border px-2 py-1 text-[11px] leading-tight font-medium ${capabilityPillClass(cap, i)}`}
                            >
                              {cap}
                            </li>
                          ))}
                        </ul>
                      </div>
                      {selected ? (
                        <p className="mt-4 text-[11px] font-semibold text-sky-800 dark:text-sky-300">
                          Selected
                        </p>
                      ) : (
                        <p className="mt-4 text-[11px] text-slate-400 dark:text-slate-600">
                          Select
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
              </fieldset>
            </FormStepCard>

            {/* Focus + thesis */}
            <FormStepCard id="step-focus">
              <fieldset className="min-w-0 space-y-6 border-0 p-0">
                <legend className="sr-only">
                  {REGISTRATION_SECTION_LABELS.focus}
                </legend>

                <div className="space-y-1.5">
                  <SectionTitle step={3}>
                    {REGISTRATION_SECTION_LABELS.focus}
                  </SectionTitle>
                  <HelperText discrete>
                    Spell out your edge—topics you care about, the bet you are
                    making, and what would flip you. This is your signal on-chain.
                  </HelperText>
                </div>

                <div className="space-y-6">
                  <div>
                    <FieldLabel>Your focus areas</FieldLabel>
                    <HelperText id="areas-interest-hint" className="mb-3" quiet>
                      Stack tags for the arenas you actually watch—not a résumé, a
                      radar.
                    </HelperText>
                    <div
                      className="flex flex-wrap items-center gap-x-2 gap-y-2 rounded-lg border border-sky-100/65 bg-white px-3 py-2.5 dark:border-sky-950/25 dark:bg-slate-950"
                      role="group"
                      aria-describedby="areas-interest-hint"
                    >
                      <div className="relative shrink-0">
                  <select
                    aria-label="Add a topic tag"
                    value=""
                    onChange={(e) => {
                      const v = e.target.value as InterestTopicValue | "";
                      if (!v || selectedInterests.includes(v)) return;
                      setSelectedInterests((prev) => [...prev, v]);
                      e.target.value = "";
                    }}
                    className="h-8 min-w-[8.5rem] cursor-pointer appearance-none rounded-md border border-sky-100/80 bg-sky-50/50 py-1 pr-7 pl-2.5 text-xs text-slate-800 outline-none transition hover:border-sky-200/90 hover:bg-sky-50/70 focus-visible:border-sky-400/80 focus-visible:ring-0 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:border-sky-800/60 dark:hover:bg-slate-900"
                  >
                    <option value="">Add a tag…</option>
                    {INTEREST_TOPICS.filter(
                      (t) => !selectedInterests.includes(t.value),
                    ).map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <span
                    className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[10px] text-slate-400 dark:text-slate-500"
                    aria-hidden
                  >
                    ▾
                  </span>
                      </div>
                      <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                  {selectedInterests.map((value) => {
                    const topicLabel =
                      INTEREST_TOPICS.find((t) => t.value === value)?.label ??
                      value;
                    return (
                      <li key={value}>
                        <span
                          className={`inline-flex max-w-full items-center gap-0.5 rounded-md border py-0.5 pr-0.5 pl-2 text-[11px] font-medium ${interestTopicPillClass(value)}`}
                        >
                          <span className="truncate">{topicLabel}</span>
                          <button
                            type="button"
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-current/70 transition hover:bg-black/10 hover:text-current dark:hover:bg-white/15"
                            aria-label={`Remove ${topicLabel}`}
                            onClick={() =>
                              setSelectedInterests((prev) =>
                                prev.filter((x) => x !== value),
                              )
                            }
                          >
                            ×
                          </button>
                        </span>
                      </li>
                    );
                  })}
                  {selectedInterests.length === 0 ? (
                    <li className="text-xs text-slate-400 not-italic dark:text-slate-600">
                      Start with one tag—show where you operate.
                    </li>
                  ) : null}
                      </ul>
                    </div>
                  </div>

                  <div>
                    <FieldLabel htmlFor="thesis-prompt">Your thesis</FieldLabel>
                    <HelperText id="thesis-prompt-hint" className="mb-3" quiet>
                      Conviction in plain language: what you believe, what you are
                      tracking, and what would prove you wrong.
                    </HelperText>
                    <textarea
                      id="thesis-prompt"
                      name="thesisPrompt"
                      rows={5}
                      maxLength={4000}
                      placeholder="The one-liner bet, the signals you trust, what keeps you up at night…"
                      value={thesisPrompt}
                      onChange={(e) => setThesisPrompt(e.target.value)}
                      aria-describedby="thesis-prompt-hint"
                      className="w-full resize-y rounded-lg border border-slate-200/95 bg-white px-3 py-2.5 text-sm leading-relaxed text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500/85 focus:ring-0 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-400/80"
                    />
                  </div>
                </div>
              </fieldset>
            </FormStepCard>

            <FormStepCard id="step-delegate">
              <fieldset className="min-w-0 space-y-4 border-0 p-0">
              <legend className="sr-only">
                {REGISTRATION_SECTION_LABELS.delegate}
              </legend>
              <SectionTitle as="h3" step={4}>
                {REGISTRATION_SECTION_LABELS.delegate}
              </SectionTitle>
              <HelperText id="delegation-eth-hint" discrete>
                Say how much ETH you intend to put behind this agent—stored as
                intent on your profile (no transfer happens in this flow).
              </HelperText>
              <FieldLabel htmlFor="delegation-eth">Amount</FieldLabel>
              <div className="flex max-w-[14rem] items-center gap-2">
                <input
                  id="delegation-eth"
                  name="delegationEth"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.25"
                  value={delegationEth}
                  onChange={(e) => setDelegationEth(e.target.value)}
                  aria-describedby="delegation-eth-hint"
                  className="min-w-0 flex-1 rounded-lg border border-slate-200/95 bg-white px-3 py-2 font-mono text-sm tabular-nums text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500/85 focus:ring-0 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-400/80"
                />
                <span className="shrink-0 text-sm font-semibold text-sky-800/75 dark:text-sky-300/75">
                  ETH
                </span>
              </div>

              {selectedAgent ? (
                <p className="rounded-lg border border-sky-100/70 bg-sky-50/45 px-3 py-2 text-xs text-slate-600 dark:border-sky-900/35 dark:bg-sky-950/22 dark:text-slate-400">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {selectedAgent.name}
                  </span>
                  {" · "}
                  <span className="font-mono font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                    {selectedAgent.accessPriceEth} ETH
                  </span>{" "}
                  access
                  {delegationEth.trim() ? (
                    <>
                      {" "}
                      · you flagged{" "}
                      <span className="font-mono font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                        {delegationEth.trim()}
                      </span>{" "}
                      ETH to delegate
                    </>
                  ) : null}
                  .{" "}
                  <span className="text-slate-500 dark:text-slate-500">
                    Agent access is billed separately from the ENS txs.
                  </span>
                </p>
              ) : null}
              </fieldset>
            </FormStepCard>

            <FormStepCard
              id="step-register"
              className="border-sky-200/70 bg-gradient-to-br from-sky-50/50 via-white to-white ring-sky-100/60 dark:border-sky-800/60 dark:from-sky-950/35 dark:via-slate-950 dark:to-slate-950 dark:ring-sky-950/40"
            >
              <div className="space-y-4">
                <SectionTitle as="h2" step={5}>
                  {REGISTRATION_SECTION_LABELS.register}
                </SectionTitle>
                <button
                  type="submit"
                  disabled={submitDisabled}
                  title={submitDisabledTitle}
                  aria-busy={isSubmitting}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-sky-900/15 transition-colors hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none dark:bg-sky-500 dark:text-slate-950 dark:shadow-black/25 dark:hover:bg-sky-400 dark:focus-visible:ring-sky-400 dark:focus-visible:ring-offset-slate-950 dark:disabled:bg-slate-700 dark:disabled:text-slate-500"
                >
                  {isSubmitting ? (
                    <>
                      <span
                        className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-white/35 border-t-white dark:border-slate-950/40 dark:border-t-slate-950"
                        aria-hidden
                      />
                      <span>
                        {signingStep === 2
                          ? "Step 2 of 2 — confirm in wallet…"
                          : "Step 1 of 2 — confirm in wallet…"}
                      </span>
                    </>
                  ) : (
                    "Register & publish"
                  )}
                </button>
                <div className="max-w-lg space-y-3 text-[10px] font-normal leading-snug text-slate-400/95 dark:text-slate-500">
                  <p>
                    <span className="font-medium text-slate-500 dark:text-slate-400">
                      Perceive · Reason · Act
                    </span>
                    {" — "}
                    Connect your wallet, then use Register above. On Sepolia you
                    sign two transactions (your wallet will prompt once per step).
                  </p>
                  <ol className="list-none space-y-2 pl-0">
                    <li
                      className={signatureStepCardClass(signatureStepVariants.step1)}
                    >
                      <span className="font-semibold text-[11px] text-current">
                        1 · Claim your handle
                      </span>
                      <span className="mt-1 block text-[9px] font-normal opacity-90">
                        Registers your{" "}
                        <span className="font-mono">your-label.agentic.eth</span>{" "}
                        subname via the registrar contract.
                      </span>
                    </li>
                    <li
                      className={signatureStepCardClass(signatureStepVariants.step2)}
                    >
                      <span className="font-semibold text-[11px] text-current">
                        2 · Publish your public profile
                      </span>
                      <span className="mt-1 block text-[9px] font-normal opacity-90">
                        Writes your focus, thesis, and agent metadata on the
                        public resolver (multicall).
                      </span>
                    </li>
                  </ol>
                  <p className="text-slate-400 dark:text-slate-500">
                    Approve each prompt in your wallet when it appears.
                  </p>
                </div>
                <details className="group rounded-lg border border-sky-100/70 bg-sky-50/40 px-4 py-3 text-xs dark:border-sky-900/40 dark:bg-sky-950/25">
                  <summary className="cursor-pointer list-none font-medium text-sky-950/80 transition hover:text-sky-950 dark:text-sky-200/90 dark:hover:text-sky-100 [&::-webkit-details-marker]:hidden">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="text-[10px] transition-transform group-open:rotate-90">
                        ▸
                      </span>
                      Technical details (contract, expiry, metadata keys)
                    </span>
                  </summary>
                  <div className="mt-3 space-y-3 border-l-2 border-sky-200/55 pl-3 font-mono text-[11px] leading-relaxed text-slate-500 dark:border-sky-800/45 dark:text-slate-500">
                    <p className="break-all">{registrar}</p>
                    <p>
                      Parent expiry ·{" "}
                      {!hasMounted
                        ? "loading…"
                        : parentExpiry !== undefined
                          ? parentExpiry.toString()
                          : expiryError
                            ? "unavailable"
                            : "loading…"}
                    </p>
                    <div className="font-sans text-[11px]">
                      <p className="mb-1.5 font-medium text-slate-600 dark:text-slate-400">
                        Metadata keys (public resolver / multicall)
                      </p>
                      <ul className="list-inside list-disc space-y-0.5 text-slate-500 dark:text-slate-500">
                        {Object.values(AGENTIC_ENS_TEXT_KEYS).map((k) => (
                          <li key={k}>{k}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </details>
              </div>
            </FormStepCard>
          </div>
        </form>
      </article>

      {registrationStatus ? (
        <div
          className={`mt-6 rounded-lg border py-3 pl-4 pr-4 text-sm leading-relaxed ${
            registrationStatus.type === "error"
              ? "border-amber-200/90 border-l-[3px] border-l-amber-500 bg-amber-50/90 text-amber-950 dark:border-amber-900/40 dark:border-l-amber-500 dark:bg-amber-950/25 dark:text-amber-100"
              : "border-sky-100/75 border-l-[3px] border-l-sky-500/70 bg-sky-50/55 text-slate-700 dark:border-sky-900/40 dark:border-l-sky-500/65 dark:bg-sky-950/28 dark:text-slate-200"
          }`}
          role="status"
        >
          {registrationStatus.type === "error" ? (
            <p>{registrationStatus.message}</p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-100">
                  Confirmed on Sepolia — links below point to the same on-chain
                  activity.
                </p>
                <p className="mt-1 font-mono text-[13px] font-semibold text-sky-950 dark:text-sky-100">
                  {registrationStatus.fullName}
                </p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Taking you to your dashboard…
                </p>
              </div>

              <ul className="list-none space-y-2.5 pl-0 text-sm">
                <li>
                  <span className="text-slate-500 dark:text-slate-400">
                    Registrar · subdomain{" "}
                  </span>
                  <a
                    href={sepoliaEtherscanTxUrl(registrationStatus.subdomainTx)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-sky-800/95 underline decoration-sky-300/50 underline-offset-2 hover:text-sky-950 dark:text-sky-300 dark:hover:text-sky-200"
                  >
                    Etherscan
                  </a>
                  <span className="ml-1.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                    {shortenTxHash(registrationStatus.subdomainTx)}
                  </span>
                </li>
                {registrationStatus.metadataTx ? (
                  <li>
                    <span className="text-slate-500 dark:text-slate-400">
                      Public resolver · metadata (multicall){" "}
                    </span>
                    <a
                      href={sepoliaEtherscanTxUrl(registrationStatus.metadataTx)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-sky-800/95 underline decoration-sky-300/50 underline-offset-2 hover:text-sky-950 dark:text-sky-300 dark:hover:text-sky-200"
                    >
                      Etherscan
                    </a>
                    <span className="ml-1.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                      {shortenTxHash(registrationStatus.metadataTx)}
                    </span>
                  </li>
                ) : null}
              </ul>

              <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-sky-200/45 pt-3 text-sm dark:border-sky-800/40">
                <a
                  href={ensSepoliaAppNameUrl(registrationStatus.fullName)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-sky-800/95 underline decoration-sky-300/50 underline-offset-2 hover:text-sky-950 dark:text-sky-300 dark:hover:text-sky-200"
                >
                  Open in ENS App (Sepolia)
                </a>
                <a
                  href={ensExplorerNameUrl(registrationStatus.fullName)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-sky-800/95 underline decoration-sky-300/50 underline-offset-2 hover:text-sky-950 dark:text-sky-300 dark:hover:text-sky-200"
                >
                  ENS Explorer (name)
                </a>
              </div>

              {registrationStatus.metadataFailedNote ? (
                <p className="border-t border-amber-200/70 pt-3 text-xs leading-relaxed text-amber-900 dark:border-amber-900/40 dark:text-amber-200/95">
                  {registrationStatus.metadataFailedNote}
                </p>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
