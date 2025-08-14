import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// RainbowKit / Wagmi
import "@rainbow-me/rainbowkit/styles.css";
import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { defineChain } from "viem";

const queryClient = new QueryClient();

const PROJECT_ID = (import.meta as any).env?.VITE_WALLETCONNECT_PROJECT_ID || "ca60bce3d0cd4f9831a61f08a4d61695";
const MONAD_RPC = (import.meta as any).env?.VITE_RPC_URL_10143 || "https://testnet-rpc.monad.xyz";
const MONAD_EXPLORER = (import.meta as any).env?.VITE_EXPLORER_URL_10143 || "";

export const MONAD_TESTNET = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: [MONAD_RPC] },
    public: { http: [MONAD_RPC] },
  },
  blockExplorers: MONAD_EXPLORER
    ? { default: { name: "Explorer", url: MONAD_EXPLORER } }
    : undefined,
  testnet: true,
});

export const LOCALHOST = defineChain({
  id: 31337,
  name: "Localhost",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
    public: { http: ["http://127.0.0.1:8545"] },
  },
  testnet: true,
});

const wagmiConfig = getDefaultConfig({
  appName: "Retro Recap Room",
  projectId: PROJECT_ID,
  chains: [MONAD_TESTNET, LOCALHOST],
  ssr: false,
});

const App = () => (
  <WagmiProvider config={wagmiConfig}>
    <QueryClientProvider client={queryClient}>
      <RainbowKitProvider initialChain={MONAD_TESTNET}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </RainbowKitProvider>
    </QueryClientProvider>
  </WagmiProvider>
);

export default App;
