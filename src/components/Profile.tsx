import React, { useEffect, useState } from 'react';
import { LogOut, User, Wallet, CheckCircle2, Link as LinkIcon, AlertTriangle, PlugZap, Network } from 'lucide-react';
import { useAccount, useChainId, useSwitchChain, useDisconnect } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { SiweMessage } from 'siwe';

interface UserProfile {
  discordId: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  email: string | null;
  joinDate: string;
  profileStats: {
    photosCount: number;
    likesReceived: number;
    commentsCount: number;
  };
  favoritePhotos: string[];
  walletAddress?: string | null;
}

interface ProfileProps {
  user: UserProfile;
  onLogout: () => void;
  onClose: () => void;
}

const TARGET_CHAIN_ID = 10143; // Monad Testnet

const Profile: React.FC<ProfileProps> = ({ user, onLogout, onClose }) => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkedAddress, setLinkedAddress] = useState<string | null>(user.walletAddress || null);

  // On mount, ask backend for current SIWE link status so the modal always reflects persisted state
  useEffect(() => {
    let isMounted = true;
    const fetchLinkStatus = async () => {
      try {
      const apiBase = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:3001';
      const res = await fetch(`${apiBase}/auth/siwe/status`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted) setLinkedAddress(data.walletAddress || null);
      } catch (_) {
        // ignore
      }
    };
    fetchLinkStatus();
    return () => {
      isMounted = false;
    };
  }, []);

  // If parent prop provides a wallet address later, adopt it (but don't clear an existing link to null)
  useEffect(() => {
    if (user.walletAddress) {
      setLinkedAddress(user.walletAddress);
    }
  }, [user.walletAddress]);

  useEffect(() => {
    if (isConnected && chainId !== TARGET_CHAIN_ID) {
      try {
        switchChain({ chainId: TARGET_CHAIN_ID });
      } catch (e) {
        // RainbowKit will prompt the user if necessary
      }
    }
  }, [isConnected, chainId, switchChain]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const shorten = (addr?: string | null) => addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '';

  const handleLinkWallet = async () => {
    try {
      setLinkError(null);
      setLinking(true);

      if (!isConnected || !address) {
        openConnectModal?.();
        setLinking(false);
        return;
      }

      // 1) Get nonce from backend
    const apiBase = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:3001';
    const nonceRes = await fetch(`${apiBase}/auth/siwe/nonce`, { credentials: 'include' });
      if (!nonceRes.ok) throw new Error('Failed to get nonce');
      const { nonce } = await nonceRes.json();

      // 2) Build SIWE message
      const domain = window.location.host;
      const origin = window.location.origin;
      const statement = 'Link your wallet to your Discord account in Retro Recap Room';
      const siweMessage = new SiweMessage({
        domain,
        address,
        statement,
        uri: origin,
        version: '1',
        chainId: TARGET_CHAIN_ID,
        nonce,
      });

      // 3) Request signature via wallet
      const preparedMessage = siweMessage.prepareMessage();
      // @ts-ignore
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [preparedMessage, address],
      });

      // 4) Verify on backend
    const verifyRes = await fetch(`${apiBase}/auth/siwe/verify`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: preparedMessage, signature }),
      });

      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}));
        throw new Error(err?.error || 'Verification failed');
      }
      const data = await verifyRes.json();
      setLinkedAddress(data.walletAddress || address);
    } catch (e: any) {
      setLinkError(e?.message || 'Failed to link wallet');
    } finally {
      setLinking(false);
    }
  };

  const walletConnected = isConnected && !!address;
  const onWrongNetwork = walletConnected && chainId !== TARGET_CHAIN_ID;
  const walletLinked = !!linkedAddress;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[hsl(var(--window-bg))] border-4 p-6 max-w-md w-full mx-4" style={{ borderStyle: 'outset' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-[hsl(var(--foreground))] flex items-center gap-2">
            <User size={20} />
            User Profile
          </h2>
          <button
            onClick={onClose}
            className="retro-button px-3 py-1 text-sm hover:bg-[hsl(var(--button-highlight))]"
          >
            ✕
          </button>
        </div>

        {/* Profile Info */}
        <div className="space-y-4">
          {/* Avatar and Username */}
          <div className="flex items-center gap-4">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={`${user.username}'s avatar`}
                className="w-16 h-16 rounded-full border-2 border-[hsl(var(--border))]"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center">
                <User size={24} className="text-[hsl(var(--muted-foreground))]" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-[hsl(var(--foreground))]">
                  {user.username}
                </h3>
                {/* Wallet indicator */}
                {!walletConnected ? (
                  <button
                    className="inline-flex items-center gap-1 text-xs retro-button px-2 py-0.5"
                    onClick={() => openConnectModal?.()}
                    title="Connect wallet"
                  >
                    <Wallet size={12} /> Connect
                  </button>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle2 size={12} /> {shorten(address)}
                    </span>
                    <button
                      onClick={() => disconnect()}
                      className="inline-flex items-center gap-1 text-xs retro-button px-2 py-0.5"
                      title="Disconnect wallet"
                    >
                      <PlugZap size={12} /> Disconnect
                    </button>
                    {onWrongNetwork && (
                      <button
                        onClick={() => switchChain({ chainId: TARGET_CHAIN_ID })}
                        disabled={isSwitching}
                        className="inline-flex items-center gap-1 text-xs retro-button px-2 py-0.5"
                        title="Switch to Monad Testnet"
                      >
                        <Network size={12} /> {isSwitching ? 'Switching…' : 'Switch to Monad'}
                      </button>
                    )}
                  </>
                )}
              </div>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">#{user.discriminator}</p>
              {onWrongNetwork && (
                <div className="mt-1 text-xs text-yellow-700 inline-flex items-center gap-1">
                  <AlertTriangle size={12} /> Wrong network, please switch to Monad Testnet.
                </div>
              )}
              {/* Link status / action */}
              <div className="mt-1 text-xs">
                {walletConnected && !walletLinked && !onWrongNetwork && (
                  <button
                    onClick={handleLinkWallet}
                    className="inline-flex items-center gap-1 retro-button px-2 py-0.5"
                    disabled={linking}
                    title="Link this wallet to your Discord account"
                  >
                    <LinkIcon size={12} /> {linking ? 'Linking…' : 'Link wallet to Discord'}
                  </button>
                )}
                {walletLinked && (
                  <div className="inline-flex items-center gap-1 text-[hsl(var(--muted-foreground))]">
                    Linked: {shorten(linkedAddress)}
                  </div>
                )}
                {linkError && (
                  <div className="text-red-600 mt-1">{linkError}</div>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-[hsl(var(--muted))] rounded">
            <div className="text-center">
              <div className="text-lg font-bold text-[hsl(var(--foreground))]">
                {user.profileStats.photosCount}
              </div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">Photos</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-[hsl(var(--foreground))]">
                {user.profileStats.likesReceived}
              </div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">Likes</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-[hsl(var(--foreground))]">
                {user.profileStats.commentsCount}
              </div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">Comments</div>
            </div>
          </div>

          {/* Member Since */}
          <div className="text-sm text-[hsl(var(--muted-foreground))]">
            Member since: {formatDate(user.joinDate)}
          </div>

          {/* Logout Button */}
          <button
            onClick={onLogout}
            className="w-full retro-button bg-red-600 hover:bg-red-700 text-white py-2 flex items-center justify-center gap-2"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile; 