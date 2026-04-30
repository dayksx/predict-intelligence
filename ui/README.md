# Predictive Intelligence — UI

Next.js app for connecting a wallet and registering ENS subnames under `agentic.eth` via the Sepolia `AgenticSubdomain` registrar.

## Getting started

```bash
pnpm install
cp .env.example .env   # fill in NEXT_PUBLIC_* values (see below)
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SEPOLIA_RPC_URL` | HTTPS Sepolia RPC for reads and ConnectKit/wagmi (recommended; can mirror `SEPOLIA_RPC_URL` from `sc/`). |
| `NEXT_PUBLIC_REGISTRAR_CONTRACT_ADDRESS` | Deployed `AgenticSubdomain` address on Sepolia (defaults to the repo’s reference deploy if unset). |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | [WalletConnect Cloud](https://cloud.walletconnect.com/) project id for ConnectKit. |

Never commit real secrets. Use a local `.env` only.

## Smart contracts

See [`../sc/README.md`](../sc/README.md) for deploy, NameWrapper approval, and `setSubdomain` details.

## Stack

- [Next.js](https://nextjs.org) (App Router)
- [wagmi](https://wagmi.sh) + [viem](https://viem.sh) + [ConnectKit](https://docs.family.co/connectkit) for Sepolia and wallet connect

## Learn more (Next.js)

- [Next.js Documentation](https://nextjs.org/docs)
- [Deploy on Vercel](https://vercel.com/new)
