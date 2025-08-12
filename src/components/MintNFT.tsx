import React, { useEffect, useMemo, useState } from 'react';
import { Wallet, CheckCircle2, AlertTriangle, Coins, Link as LinkIcon, ListChecks } from 'lucide-react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useWriteContract } from 'wagmi';

const TARGET_CHAIN_ID = 10143; // Monad Testnet

// ERC-1155 minting uses mintWithPermit; no ERC-721 here

const MintNFT: React.FC = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { openConnectModal } = useConnectModal();
  const { writeContractAsync, isPending } = useWriteContract();

  const [contractAddress, setContractAddress] = useState<string>('0x0C79F8bA74597Eab7338196D96df5Fa160D3c51B');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [achievements, setAchievements] = useState<Array<{ id: string; name: string; description: string; earned: boolean; minted?: boolean; mintedTx?: string | null }>>([]);
  const [selectedAchievement, setSelectedAchievement] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'mint' | 'badges'>('mint');

  const walletConnected = isConnected && !!address;
  const onWrongNetwork = walletConnected && chainId !== TARGET_CHAIN_ID;

  const canMint = useMemo(() => {
    return walletConnected && !onWrongNetwork && !!contractAddress && !!selectedAchievement && !isPending;
  }, [walletConnected, onWrongNetwork, contractAddress, selectedAchievement, isPending]);

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
      if (!contractAddress) return;
      if (!selectedAchievement) return; // only mint via achievements now

      // 1) Ask backend for EIP-712 permit for this achievement
      const permitRes = await fetch(`http://localhost:3001/api/achievements/${selectedAchievement}/permit`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!permitRes.ok) {
        const err = await permitRes.json().catch(() => ({}));
        throw new Error(err?.error || 'Failed to get permit');
      }
      const permit = await permitRes.json();

      // 2) Call ERC-1155 mintWithPermit
      const ABI = [
        {
          type: 'function',
          name: 'mintWithPermit',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'to', type: 'address' },
            { name: 'id', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
            { name: 'nonce', type: 'bytes32' },
            { name: 'signature', type: 'bytes' },
          ],
          outputs: [],
        },
      ];
      const tx = await writeContractAsync({
        abi: ABI as any,
        address: contractAddress as `0x${string}`,
        functionName: 'mintWithPermit',
        args: [permit.to, BigInt(permit.id), BigInt(permit.deadline), permit.nonce as `0x${string}`, permit.signature as `0x${string}`],
        chainId: TARGET_CHAIN_ID,
      });
      // tx is the transaction hash when using wagmi v2's writeContractAsync
      const hash = typeof tx === 'string' ? tx : (tx as any)?.hash || null;
      setTxHash(hash);
      // If minted for an achievement, record it server-side to prevent duplicates
      if (hash && selectedAchievement) {
        await fetch(`http://localhost:3001/api/achievements/${selectedAchievement}/minted`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ txHash: hash }),
        }).catch(() => {});
        // refresh achievements to reflect minted state
        await loadAchievements();
      }
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || 'Mint failed');
    }
  };

  const loadAchievements = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/achievements', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAchievements(data.achievements || []);
      }
    } catch (_) {}
  };

  useEffect(() => {
    loadAchievements();
  }, []);

  return (
    <div className="h-full w-full p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-[hsl(var(--foreground))] font-bold text-lg flex items-center gap-2">
          {activeTab === 'mint' ? <Coins size={18} /> : <ListChecks size={18} />} {activeTab === 'mint' ? 'Mint NFT' : 'My Badges'}
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

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          className={`retro-button px-2 py-1 ${activeTab === 'mint' ? 'bg-[hsl(var(--button-highlight))]' : ''}`}
          onClick={() => setActiveTab('mint')}
        >
          Mint
        </button>
        <button
          className={`retro-button px-2 py-1 ${activeTab === 'badges' ? 'bg-[hsl(var(--button-highlight))]' : ''}`}
          onClick={() => setActiveTab('badges')}
        >
          Badges
        </button>
      </div>

      {activeTab === 'mint' ? (
        <div className="space-y-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[hsl(var(--muted-foreground))]">Select Achievement (optional)</label>
          <select
            className="w-full px-3 py-2 border-2 bg-[hsl(var(--window-bg))] text-[hsl(var(--foreground))]"
            value={selectedAchievement}
            onChange={(e) => setSelectedAchievement(e.target.value)}
          >
            <option value="">— Choose an achievement to mint —</option>
            {achievements.map((a) => (
              <option key={a.id} value={a.id} disabled={!a.earned || a.minted}>
                {a.name} {!a.earned ? '(locked)' : a.minted ? '(minted)' : ''}
              </option>
            ))}
          </select>
          <div className="text-[hsl(var(--muted-foreground))] text-xs">
              Picking an achievement will mint the corresponding on-chain badge (ERC-1155) after a server permit.
          </div>
        </div>
      </div>
      ) : (
        <div className="flex-1 flex flex-col space-y-3 min-h-0">
          <div className="text-sm text-[hsl(var(--muted-foreground))]">Your achievements</div>
          <div className="grid grid-cols-1 gap-2 overflow-y-auto pr-1" style={{ maxHeight: '60vh' }}>
            {achievements.length === 0 && (
              <div className="text-xs text-[hsl(var(--muted-foreground))]">No achievements yet.</div>
            )}
            {achievements.map((a) => (
              <div key={a.id} className="border-2 p-3 bg-[hsl(var(--window-bg))] flex items-center justify-between">
                <div>
                  <div className="text-[hsl(var(--foreground))] font-bold">{a.name}</div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">{a.description}</div>
                </div>
                <div className="text-xs">
                  {a.minted ? (
                    <span className="text-green-700 inline-flex items-center gap-1"><CheckCircle2 size={12} /> Minted</span>
                  ) : a.earned ? (
                    <button
                      className="retro-button px-2 py-1"
                      disabled={isPending}
                      onClick={() => { setSelectedAchievement(a.id); handleMint(); }}
                    >
                      Mint
                    </button>
                  ) : (
                    <span className="text-[hsl(var(--muted-foreground))]">Locked</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'mint' && (
      <div className="mt-2 flex items-center gap-2">
        <button
          className="retro-button px-3 py-2"
          onClick={handleMint}
          disabled={!canMint}
          title={walletConnected ? (onWrongNetwork ? 'Switch to Monad Testnet' : 'Mint NFT') : 'Connect wallet'}
        >
          <LinkIcon size={14} /> {isPending ? 'Minting…' : 'Mint'}
        </button>
      </div>
      )}

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
        Uses ERC-1155 on Monad Testnet (chainId {TARGET_CHAIN_ID}). Badges mint with a server EIP-712 permit; only earned achievements can be minted.
      </div>
    </div>
  );
};

export default MintNFT;

