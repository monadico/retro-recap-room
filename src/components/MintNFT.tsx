import React, { useMemo, useState } from 'react';
import { Wallet, CheckCircle2, AlertTriangle, Coins, Link as LinkIcon } from 'lucide-react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useWriteContract } from 'wagmi';

const TARGET_CHAIN_ID = 10143; // Monad Testnet

const ERC721_SAFE_MINT_ABI = [
  {
    type: 'function',
    name: 'safeMint',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'uri', type: 'string' },
    ],
    outputs: [],
  },
];

const MintNFT: React.FC = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { openConnectModal } = useConnectModal();
  const { writeContractAsync, isPending } = useWriteContract();

  const [contractAddress, setContractAddress] = useState<string>(
    (import.meta as any).env?.VITE_NFT_CONTRACT_ADDRESS || ''
  );
  const [tokenURI, setTokenURI] = useState<string>('');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const walletConnected = isConnected && !!address;
  const onWrongNetwork = walletConnected && chainId !== TARGET_CHAIN_ID;

  const canMint = useMemo(() => {
    return walletConnected && !onWrongNetwork && contractAddress && tokenURI && !isPending;
  }, [walletConnected, onWrongNetwork, contractAddress, tokenURI, isPending]);

  const handleMint = async () => {
    try {
      setError(null);
      setTxHash(null);
      if (!walletConnected) {
        openConnectModal?.();
        return;
      }
      if (onWrongNetwork) {
        try {
          switchChain({ chainId: TARGET_CHAIN_ID });
        } catch {
          // UI button below will also allow switching
        }
        return;
      }
      if (!contractAddress || !tokenURI) return;

      const tx = await writeContractAsync({
        abi: ERC721_SAFE_MINT_ABI as any,
        address: contractAddress as `0x${string}`,
        functionName: 'safeMint',
        args: [address!, tokenURI],
        chainId: TARGET_CHAIN_ID,
      });
      // tx is the transaction hash when using wagmi v2's writeContractAsync
      setTxHash(typeof tx === 'string' ? tx : (tx as any)?.hash || null);
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || 'Mint failed');
    }
  };

  return (
    <div className="h-full w-full p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-[hsl(var(--foreground))] font-bold text-lg flex items-center gap-2">
          <Coins size={18} /> Mint NFT
        </div>
        <div className="flex items-center gap-2 text-xs">
          {!walletConnected ? (
            <button
              className="retro-button px-2 py-1"
              title="Connect wallet"
              onClick={() => openConnectModal?.()}
            >
              <Wallet size={12} /> Connect
            </button>
          ) : (
            <>
              <span className="inline-flex items-center gap-1 text-green-600">
                <CheckCircle2 size={12} /> Connected
              </span>
              {onWrongNetwork && (
                <button
                  className="retro-button px-2 py-1"
                  onClick={() => switchChain({ chainId: TARGET_CHAIN_ID })}
                  disabled={isSwitching}
                  title="Switch to Monad Testnet"
                >
                  {isSwitching ? 'Switching…' : 'Switch Network'}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[hsl(var(--muted-foreground))]">Contract Address (ERC-721 with safeMint)</label>
          <input
            className="w-full px-3 py-2 border-2 bg-[hsl(var(--window-bg))] text-[hsl(var(--foreground))]"
            placeholder="0x..."
            value={contractAddress}
            onChange={(e) => setContractAddress(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[hsl(var(--muted-foreground))]">Token URI (metadata URL)</label>
          <input
            className="w-full px-3 py-2 border-2 bg-[hsl(var(--window-bg))] text-[hsl(var(--foreground))]"
            placeholder="https://.../metadata.json"
            value={tokenURI}
            onChange={(e) => setTokenURI(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button
          className="retro-button px-3 py-2"
          onClick={handleMint}
          disabled={!canMint}
          title={walletConnected ? (onWrongNetwork ? 'Switch to Monad Testnet' : 'Mint NFT') : 'Connect wallet'}
        >
          <LinkIcon size={14} /> {isPending ? 'Minting…' : 'Mint'}
        </button>
        {!contractAddress && (
          <span className="text-xs text-[hsl(var(--muted-foreground))]">Set contract address to enable mint</span>
        )}
      </div>

      {txHash && (
        <div className="text-xs mt-2">
          <span className="text-[hsl(var(--muted-foreground))]">Tx Hash:</span>{' '}
          <code className="break-all">{txHash}</code>
        </div>
      )}

      {error && (
        <div className="text-xs text-red-600 mt-1 flex items-center gap-1">
          <AlertTriangle size={12} /> {error}
        </div>
      )}

      <div className="text-xs text-[hsl(var(--muted-foreground))] mt-auto">
        Note: This UI expects an ERC-721 contract that exposes safeMint(address to, string uri) on Monad Testnet (chainId {TARGET_CHAIN_ID}). Configure `VITE_NFT_CONTRACT_ADDRESS` to prefill the address.
      </div>
    </div>
  );
};

export default MintNFT;

