import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ReactTogether, useStateTogether } from 'react-together';

// Minimal synchronized audio "radio" prototype using a public domain/CC audio stream placeholder.
// We synchronize just two fields across clients: currentTrackIndex and startedAtUtc.

const CONTROLLER_DISCORD_ID = '348265632770424832';
const PLAYLIST_ID = 'RDQMPDwr0RxgjY4';

type YTPlayer = any;

const RadioCore: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [userDiscordId, setUserDiscordId] = useState<string | null>(null);
  const isController = userDiscordId === CONTROLLER_DISCORD_ID;
  const [needsStart, setNeedsStart] = useState(false);

  // Shared state (controller writes, others follow)
  const [ytState, setYtState] = useStateTogether('yt.state', {
    videoId: '',
    timeSec: 0,
    paused: false,
    updatedAt: Date.now(),
  });
  const [bootstrapped, setBootstrapped] = useState(false);

  // Fetch user id
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('http://localhost:3001/auth/user', { credentials: 'include' });
        if (r.ok) {
          const u = await r.json();
          setUserDiscordId(u?.discordId || null);
        } else {
          setUserDiscordId(null);
        }
      } catch {
        setUserDiscordId(null);
      }
    })();
  }, []);

  // Load YouTube IFrame API
  useEffect(() => {
    function ensureApi(): Promise<void> {
      return new Promise((resolve) => {
        if ((window as any).YT && (window as any).YT.Player) return resolve();
        const onReady = () => resolve();
        (window as any).onYouTubeIframeAPIReady = onReady;
        const s = document.createElement('script');
        s.src = 'https://www.youtube.com/iframe_api';
        document.body.appendChild(s);
      });
    }

    let mounted = true;
    (async () => {
      await ensureApi();
      if (!mounted || !containerRef.current) return;
      const YT = (window as any).YT;
      playerRef.current = new YT.Player(containerRef.current, {
        height: '360',
        width: '640',
        playerVars: {
          listType: 'playlist',
          list: PLAYLIST_ID,
          autoplay: 1,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          origin: window.location.origin,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            // Start muted automatically to satisfy autoplay policy
            setPlayerReady(true);
            try {
              playerRef.current?.mute?.();
              playerRef.current?.playVideo?.();
              setNeedsStart(false);
            } catch {}
          },
          onError: (e: any) => {
            // 101/150: embedding disabled; try to skip to next video
            try {
              const p = playerRef.current;
              if (!p) return;
              if (typeof p.nextVideo === 'function') p.nextVideo();
              else if (typeof p.getPlaylistIndex === 'function' && typeof p.playVideoAt === 'function') {
                const idx = (p.getPlaylistIndex?.() ?? 0) + 1;
                p.playVideoAt(idx);
              }
            } catch {}
          },
          onStateChange: (e: any) => {
            const state = e?.data;
            if (state === 1) setNeedsStart(false); // playing
          },
        },
      });
    })();
    return () => { mounted = false; };
  }, []);

  // Bootstrap from backend persisted state once the player is ready (both controller and listeners)
  useEffect(() => {
    if (!playerReady) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('http://localhost:3001/api/mixtapes/state');
        if (!r.ok) return;
        const s = await r.json();
        const p = playerRef.current;
        if (!p || cancelled) return;
        try {
          // If saved videoId exists, cue playlist at saved index and then seek
          if (typeof p.cuePlaylist === 'function') {
            p.cuePlaylist({ listType: 'playlist', list: PLAYLIST_ID, index: s.index || 0, startSeconds: s.timeSec || 0, suggestedQuality: 'default' });
            if (!s.paused && typeof p.playVideo === 'function') p.playVideo();
            if (s.paused && typeof p.pauseVideo === 'function') p.pauseVideo();
          } else if (typeof p.loadVideoById === 'function' && s.videoId) {
            p.loadVideoById({ videoId: s.videoId, startSeconds: s.timeSec || 0 });
          }
        } catch {}
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [playerReady]);

  // Controller publishes state periodically
  useEffect(() => {
    if (!isController) return;
    if (!bootstrapped) setBootstrapped(true);
    const t = setInterval(() => {
      const p = playerRef.current;
      if (!p || typeof p.getCurrentTime !== 'function') return;
      const videoId = p.getVideoData()?.video_id || '';
      const timeSec = Math.floor(p.getCurrentTime?.() || 0);
      const ps = p.getPlayerState?.();
      const paused = ps === 2; // 2 = PAUSED
      const index = typeof p.getPlaylistIndex === 'function' ? (p.getPlaylistIndex() ?? 0) : 0;
      setYtState({ videoId, timeSec, paused, updatedAt: Date.now() });
      // persist to backend for continuity when sessions are empty
      try {
        fetch('http://localhost:3001/api/mixtapes/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playlistId: PLAYLIST_ID, videoId, timeSec, paused, index, updatedAt: Date.now() }),
        });
      } catch {}
    }, 1500);
    return () => clearInterval(t);
  }, [isController, setYtState, bootstrapped]);

  // On unload, persist one last time (controller only)
  useEffect(() => {
    if (!isController) return;
    const handler = () => {
      try {
        const p = playerRef.current;
        if (!p) return;
        const videoId = p.getVideoData()?.video_id || '';
        const timeSec = Math.floor(p.getCurrentTime?.() || 0);
        const ps = p.getPlayerState?.();
        const paused = ps === 2;
        const index = typeof p.getPlaylistIndex === 'function' ? (p.getPlaylistIndex() ?? 0) : 0;
        navigator.sendBeacon?.('http://localhost:3001/api/mixtapes/state', new Blob([
          JSON.stringify({ playlistId: PLAYLIST_ID, videoId, timeSec, paused, index, updatedAt: Date.now() })
        ], { type: 'application/json' }));
      } catch {}
    };
    window.addEventListener('beforeunload', handler);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') handler();
    });
    return () => {
      window.removeEventListener('beforeunload', handler);
    };
  }, [isController]);

  // Followers apply shared state
  useEffect(() => {
    if (isController) return; // controller does not follow
    const p = playerRef.current;
    if (!p || !ytState) return;
    try {
      const currentId = p.getVideoData?.().video_id || '';
      if (ytState.videoId && ytState.videoId !== currentId && typeof p.loadVideoById === 'function') {
        p.loadVideoById({ videoId: ytState.videoId, startSeconds: ytState.timeSec });
        return;
      }
      const drift = Math.abs((p.getCurrentTime?.() || 0) - (ytState.timeSec || 0));
      if (drift > 1.5 && typeof p.seekTo === 'function') p.seekTo(ytState.timeSec || 0, true);
      if (ytState.paused && typeof p.pauseVideo === 'function') p.pauseVideo();
      if (!ytState.paused && typeof p.playVideo === 'function') p.playVideo();
    } catch {}
  }, [ytState, isController]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-2 border-b">
        <div className="font-bold">Mixtapes (Multisynq Radio)</div>
        <div className="text-xs opacity-70">{isController ? 'Controller' : 'Listener'}</div>
      </div>
      <div className="p-3 text-xs opacity-70">Playlist: {PLAYLIST_ID}</div>
      <div className="flex-1 flex items-center justify-center relative">
        <div ref={containerRef} />
      </div>
    </div>
  );
};

class Boundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; message?: string }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(err: any) {
    return { hasError: true, message: String(err?.message || err) };
  }
  componentDidCatch(err: any) { console.error('Mixtapes render error:', err); }
  render() {
    if (this.state.hasError) {
      return <div className="p-4 text-red-500 text-sm">Mixtapes error: {this.state.message}</div>;
    }
    return this.props.children as any;
  }
}

const Mixtapes: React.FC = () => {
  const apiKey = (import.meta as any).env?.VITE_MULTISYNQ_API_KEY || '2hpadFLUJXyVrPLWmg5cIVf6vHFTHG73AoT0uhPgVQ';
  const appId = (import.meta as any).env?.VITE_MULTISYNQ_APP_ID || 'io.retrorecap.room';

  return (
    <Boundary>
      <ReactTogether
        sessionParams={{ appId, apiKey, name: 'mixtapes-radio' }}
        rememberUsers={true}
        sessionIgnoresUrl={true}
      >
        <RadioCore />
      </ReactTogether>
    </Boundary>
  );
};

export default Mixtapes;

