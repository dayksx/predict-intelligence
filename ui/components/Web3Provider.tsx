"use client";

import type { ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";
import { useTheme } from "@/components/ThemeProvider";

const config = createConfig(
    getDefaultConfig({
        chains: [sepolia],
        transports: {
            [sepolia.id]: http(
                typeof process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL === "string" &&
                    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL.length > 0
                    ? process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL
                    : undefined,
            ),
        },
        walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
        appName: "Predictive Intelligence",
        appDescription:
            "Define focus, choose an agent across prediction and crypto markets, then perceive, reason, and act—with agentic ENS.",
        appUrl: "localhost:3000",
        appIcon: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRyaABWcmnGLNG6t-RJys4-0c6720zg5VYMcg&s",
    }),
);

const queryClient = new QueryClient();

type Web3ProviderProps = { children: ReactNode };

function ConnectKitWithAppTheme({ children }: Web3ProviderProps) {
    const { theme } = useTheme();
    return (
        <ConnectKitProvider mode={theme}>
            {children}
        </ConnectKitProvider>
    );
}

export const Web3Provider = ({ children }: Web3ProviderProps) => {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <ConnectKitWithAppTheme>{children}</ConnectKitWithAppTheme>
            </QueryClientProvider>
        </WagmiProvider>
    );
};