# Predictive Intelligence — UI

Next.js app for connecting a wallet, registering ENS subnames under `agentic.eth` via the Sepolia `AgenticSubdomain` registrar, and browsing per-agent delegation analytics and activity.

## Getting started

```bash
pnpm install
cp .env.example .env   # fill in NEXT_PUBLIC_* values (see below)
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Routes

| Path | Purpose |
|------|---------|
| `/` | **Registration** — `AgentRegistrationForm`: connect wallet, register a subdomain, set ENS text records (agent name, focus domain, thesis prompt, delegated ETH, avatar URL, etc.). |
| `/dashboard` | **Dashboard** — Lists agentic subdomains for the connected address, ENS-backed profile header, links to each agent. |
| `/dashboard/agents/[label]` | **Agent detail** — `label` is the subdomain part only (e.g. `myagent` for `myagent.agentic.eth`). Shows delegation yield UI, live sidebar, and Perceive / Reason / Triggered activity sections. |

## Delegation yield UI

On the agent detail page, data is assembled in [`lib/delegation-yield-snapshot.ts`](lib/delegation-yield-snapshot.ts) and rendered by [`components/agent/AgentDelegationYieldHero.tsx`](components/agent/AgentDelegationYieldHero.tsx):

- **Metrics strip** — Delegated ETH (from ENS `agentic.delegatedAmount`), grouped **venue chart** (Swap / Perps / Predict: gains up, losses down), **Wins / Losses** split card, **Net P&L**, **Book** (delegation + net).
- **Outcome diagram** — Narrow left column: waterfall-style SVG (initial delegation, gains, losses, dashed book line).
- **Layout** — From `lg` breakpoints, the diagram sits in a fixed max-width column beside the live sidebar; the metrics strip spans full width above.

Realized wins/losses and per-venue splits will eventually come from your indexer. Until then, optional **mock** values demonstrate the layout.

## Environment variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SEPOLIA_RPC_URL` | HTTPS Sepolia RPC for reads and ConnectKit/wagmi (recommended; can mirror `SEPOLIA_RPC_URL` from `sc/`). |
| `NEXT_PUBLIC_REGISTRAR_CONTRACT_ADDRESS` | Deployed `AgenticSubdomain` address on Sepolia (defaults to the repo’s reference deploy if unset). |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | [WalletConnect Cloud](https://cloud.walletconnect.com/) project id for ConnectKit. |
| `NEXT_PUBLIC_MOCK_AGENT_YIELD` | Optional. When mock delegation yield is enabled, the UI fills demo wins/losses (and split venue P&L). Set to `true` or `1` to force on, `false` or `0` to force off. If unset, **development** defaults to mock data; **production** defaults off. |

Never commit real secrets. Use a local `.env` only.

## Smart contracts

See [`../sc/README.md`](../sc/README.md) for deploy, NameWrapper approval, and `setSubdomain` details.

## Stack

- [Next.js](https://nextjs.org) (App Router)
- [wagmi](https://wagmi.sh) + [viem](https://viem.sh) + [ConnectKit](https://docs.family.co/connectkit) for Sepolia and wallet connect
- [Tailwind CSS](https://tailwindcss.com) v4

## Learn more (Next.js)

- [Next.js Documentation](https://nextjs.org/docs)
- [Deploy on Vercel](https://vercel.com/new)
