import React, { useEffect, useMemo, useState } from 'react';
import { useAccount, useWriteContract, useChainId, useSwitchChain } from 'wagmi';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { config } from '../config/environment';

interface CanvaStatePlacement {
  x: number;
  y: number;
  discordId: string;
  username: string;
  avatarUrl: string | null;
  message?: string;
  placedAt: string;
}

interface CanvaState {
  width: number;
  height: number;
  placements: CanvaStatePlacement[];
}

const CELL_PX = 24;

const TheCanva: React.FC = () => {
  const [state, setState] = useState<CanvaState | null>(null);
  const [selected, setSelected] = useState<{ x: number; y: number } | null>(null);
  const [message, setMessage] = useState('');
  const [isPlacing, setIsPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { address, isConnected } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const EXPECTED_CHAIN_ID = 10143; // Monad Testnet
  const onWrongNetwork = isConnected && chainId !== EXPECTED_CHAIN_ID;

  // Load canvas state on component mount
  useEffect(() => {
    const loadCanvasState = async () => {
      try {
        const response = await fetch(`${config.apiBase}/api/canva/state`);
        if (response.ok) {
          const data = await response.json();
          setState(data);
        }
      } catch (error) {
        console.error('Error loading canvas state:', error);
      }
    };

    loadCanvasState();
  }, []);

  // Remove the handleSave function since it's not supported by the API
  // The canvas works with placements, not drawing data

  const isTaken = useMemo(() => {
    const set = new Set(state?.placements.map(p => `${p.x},${p.y}`) || []);
    return (x: number, y: number) => set.has(`${x},${y}`);
  }, [state]);

  const handleCellClick = (x: number, y: number) => {
    if (!state) return;
    if (isTaken(x, y)) return;
    setSelected({ x, y });
  };

  const placeMe = async () => {
    if (!selected) return;
    try {
      setIsPlacing(true);
      setError(null);
      if (!isConnected || !address) {
        throw new Error('Connect wallet first');
      }
      if (onWrongNetwork) {
        try {
          switchChain({ chainId: EXPECTED_CHAIN_ID });
        } catch {}
        throw new Error('Wrong network. Please switch to Monad Testnet (10143).');
      }

      // 1) Get mint params from backend
      const paramsRes = await fetch(`${config.apiBase}/api/canva/mint-params`, {
        method: 'POST',
        credentials: 'include',
      });
      const mintParams = await paramsRes.json();
      if (!paramsRes.ok) throw new Error(mintParams?.error || 'Failed to get mint params');

      // 2) Mint token that shares dynamic metadata
      console.log('Minting on chain', chainId, 'expected', EXPECTED_CHAIN_ID, 'params', mintParams);
      const ABI = [
        { type: 'function', name: 'mint', stateMutability: 'nonpayable', inputs: [ { name: 'to', type: 'address' }, { name: 'tokenId', type: 'uint256' } ], outputs: [] },
        { type: 'function', name: 'baseURI', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'string' } ] },
      ];
      const txHash = await writeContractAsync({
        abi: ABI as any,
        address: mintParams.address as `0x${string}`,
        functionName: 'mint',
        args: [address as `0x${string}`, BigInt(mintParams.tokenId)],
        chainId: EXPECTED_CHAIN_ID,
      });
      const hash = typeof txHash === 'string' ? txHash : (txHash as any)?.hash || null;

      // 3) Place on canva
      const res = await fetch(`${config.apiBase}/api/canva/place`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x: selected.x, y: selected.y, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to place');
      setState(data.state);
      setSelected(null);
      setMessage('');
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || 'Failed');
    } finally {
      setIsPlacing(false);
    }
  };

  if (!state) {
    return (
      <div className="h-full w-full p-4 text-[hsl(var(--muted-foreground))]">Loading canva…</div>
    );
  }

  return (
    <div className="h-full w-full p-4 flex flex-col gap-3">
      <div className="text-[hsl(var(--foreground))] font-bold flex items-center gap-3">
        <span>The Canva</span>
        {isConnected ? (
          onWrongNetwork ? (
            <button
              className="retro-button px-2 py-1 text-xs"
              onClick={() => switchChain({ chainId: EXPECTED_CHAIN_ID })}
              disabled={isSwitching}
              title="Switch to Monad Testnet (10143)"
            >
              {isSwitching ? 'Switching…' : 'Switch to Monad Testnet'}
            </button>
          ) : (
            <span className="text-xs text-green-600">Connected</span>
          )
        ) : (
          <span className="text-xs text-[hsl(var(--muted-foreground))]">Connect wallet</span>
        )}
      </div>
      <div className="flex gap-4">
        <div
          className="border-2 bg-[hsl(var(--window-bg))] p-2 overflow-auto"
          style={{ maxHeight: 400 }}
        >
          <div
            style={{
              position: 'relative',
              width: state.width * CELL_PX,
              height: state.height * CELL_PX,
              background: '#0b1020',
            }}
          >
            {/* grid */}
            {Array.from({ length: state.height }).map((_, yy) => (
              <div key={yy} style={{ display: 'flex' }}>
                {Array.from({ length: state.width }).map((_, xx) => {
                  const taken = isTaken(xx, yy);
                  const sel = selected && selected.x === xx && selected.y === yy;
                  return (
                    <div
                      key={`${xx}-${yy}`}
                      onClick={() => handleCellClick(xx, yy)}
                      title={taken ? 'Taken' : 'Available'}
                      style={{
                        width: CELL_PX,
                        height: CELL_PX,
                        border: '1px solid #1e2a4a',
                        background: sel ? '#143b8f' : taken ? '#334155' : '#0f172a',
                        cursor: taken ? 'not-allowed' : 'pointer',
                      }}
                    />
                  );
                })}
              </div>
            ))}

            {/* placements */}
            {state.placements.map((p) => (
              <div
                key={`${p.x},${p.y}`}
                title={p.message ? `${p.username}: ${p.message}` : p.username}
                style={{
                  position: 'absolute',
                  left: p.x * CELL_PX,
                  top: p.y * CELL_PX,
                  width: CELL_PX,
                  height: CELL_PX,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#1d4ed8',
                  color: '#fff',
                  fontSize: 10,
                  fontFamily: 'monospace',
                }}
              >
                {(p.username || 'U').slice(0, 2).toUpperCase()}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 space-y-2">
          <div className="text-sm text-[hsl(var(--muted-foreground))]">Pick a cell and leave an optional hover message (max 140 chars).</div>
          <input
            className="w-full px-3 py-2 border-2 bg-[hsl(var(--window-bg))] text-[hsl(var(--foreground))]"
            placeholder="Optional message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={140}
          />
          <div className="flex items-center gap-2 text-xs">
            <button
              className="retro-button px-3 py-2"
              onClick={placeMe}
              disabled={!selected || isPlacing || isPending}
            >
              {isPlacing || isPending ? 'Placing…' : 'Add me to the canva'}
            </button>
            {selected && (
              <span className="text-[hsl(var(--muted-foreground))]">Selected: ({selected.x}, {selected.y})</span>
            )}
          </div>
          {error && (
            <div className="text-xs text-red-600">{error}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TheCanva;


