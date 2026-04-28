"use client";

import type { ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";

const config = createConfig(
    getDefaultConfig({
        chains: [sepolia],
        transports: {
            [sepolia.id]: http(),
        },
        walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
        appName: "Predictive Intelligence",
        appDescription: "Agentic Marketplace with agent as services meta intelligence for onchain execution",
        appUrl: "localhost:3000",
        appIcon: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRyaABWcmnGLNG6t-RJys4-0c6720zg5VYMcg&s",
    }),
);

const queryClient = new QueryClient();

type Web3ProviderProps = { children: ReactNode };

export const Web3Provider = ({ children }: Web3ProviderProps) => {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <ConnectKitProvider>{children}</ConnectKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    )
}