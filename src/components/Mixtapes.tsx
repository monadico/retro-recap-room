import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ReactTogether, useStateTogether } from 'react-together';

// Minimal synchronized audio "radio" prototype using a public domain/CC audio stream placeholder.
// We synchronize just two fields across clients: currentTrackIndex and startedAtUtc.

const CONTROLLER_DISCORD_ID = '348265632770424832';
const PLAYLIST_ID = 'RDQMwbpzXXO29_k';

type YTPlayer = any;

const RadioCore: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [userDiscordId, setUserDiscordId] = useState<string | null>(null);
  const isController = userDiscordId === CONTROLLER_DISCORD_ID;

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
        },
        events: {
          onReady: () => {
            try { playerRef.current?.mute(); } catch {}
          },
        },
      });
    })();
    return () => { mounted = false; };
  }, []);

  // Controller publishes state periodically
  useEffect(() => {
    if (!isController) return;
    // one-time bootstrap from backend persisted state
    (async () => {
      if (bootstrapped) return;
      try {
        const r = await fetch('http://localhost:3001/api/mixtapes/state');
        if (r.ok) {
          const s = await r.json();
          const p = playerRef.current;
          if (p && s) {
            try {
              if (s.videoId && typeof p.loadVideoById === 'function') {
                p.loadVideoById({ videoId: s.videoId, startSeconds: s.timeSec || 0 });
              } else if (typeof p.seekTo === 'function') {
                p.seekTo(s.timeSec || 0, true);
              }
              if (s.paused && typeof p.pauseVideo === 'function') p.pauseVideo();
            } catch {}
          }
        }
      } catch {}
      setBootstrapped(true);
    })();
    const t = setInterval(() => {
      const p = playerRef.current;
      if (!p || typeof p.getCurrentTime !== 'function') return;
      const videoId = p.getVideoData()?.video_id || '';
      const timeSec = Math.floor(p.getCurrentTime?.() || 0);
      const ps = p.getPlayerState?.();
      const paused = ps === 2; // 2 = PAUSED
      setYtState({ videoId, timeSec, paused, updatedAt: Date.now() });
      // persist to backend for continuity when sessions are empty
      try {
        fetch('http://localhost:3001/api/mixtapes/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playlistId: PLAYLIST_ID, videoId, timeSec, paused, updatedAt: Date.now() }),
        });
      } catch {}
    }, 1500);
    return () => clearInterval(t);
  }, [isController, setYtState, bootstrapped]);

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
      <div className="flex-1 flex items-center justify-center">
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

