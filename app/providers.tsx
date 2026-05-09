"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { filecoinCalibration } from "wagmi/chains";

const queryClient = new QueryClient();

const WALLET_CONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID ?? "";
const hasWalletConnectProjectId = WALLET_CONNECT_PROJECT_ID.length > 0;
const FILECOIN_RPC_URL = process.env.NEXT_PUBLIC_FILECOIN_RPC;
const filecoinTransport = FILECOIN_RPC_URL ? http(FILECOIN_RPC_URL) : http();

const baseConfig = createConfig({
  chains: [filecoinCalibration],
  connectors: [],
  ssr: true,
  transports: {
    [filecoinCalibration.id]: filecoinTransport,
  },
});

const config = hasWalletConnectProjectId
  ? getDefaultConfig({
      appName: "Filecoin Starter Kit",
      projectId: WALLET_CONNECT_PROJECT_ID,
      chains: [filecoinCalibration],
      ssr: true,
      transports: {
        [filecoinCalibration.id]: filecoinTransport,
      },
    })
  : baseConfig;

export default function ContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!hasWalletConnectProjectId) {
      console.warn(
        "WalletConnect is disabled because NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID is not set. Set it in .env.local to enable wallet connections."
      );
    }
  }, []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
