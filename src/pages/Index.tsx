import React, { useState } from 'react';
import RetroWindow from '../components/RetroWindow';
import PoolTV from '../components/PoolTV';
import Guestbook from '../components/Guestbook';
import DesktopDock from '../components/DesktopDock';
import retroDesktopBg from '../assets/retro-desktop-bg.jpg';

interface OpenWindow {
  id: string;
  type: string;
  title: string;
  isMinimized: boolean;
}

const Index = () => {
  const [openWindows, setOpenWindows] = useState<OpenWindow[]>([]);

  const openWindow = (windowType: string) => {
    const windowId = `${windowType}-${Date.now()}`;
    const windowTitles: Record<string, string> = {
      'pool-tv': 'Pool TV - Video Player',
      'guestbook': 'Community Guestbook',
      'mixtapes': 'Mixtapes - Audio Player',
      'gallery': 'The Gallery - Photo Viewer',
      'x-feed': 'X Feed - Social Media',
      'calendar': 'Community Events',
      'system': 'System Settings'
    };

    const newWindow: OpenWindow = {
      id: windowId,
      type: windowType,
      title: windowTitles[windowType] || 'Unknown Window',
      isMinimized: false
    };

    setOpenWindows(prev => [...prev, newWindow]);
  };

  const closeWindow = (windowId: string) => {
    setOpenWindows(prev => prev.filter(w => w.id !== windowId));
  };

  const minimizeWindow = (windowId: string) => {
    setOpenWindows(prev => 
      prev.map(w => w.id === windowId ? { ...w, isMinimized: true } : w)
    );
  };

  const getWindowContent = (windowType: string) => {
    switch (windowType) {
      case 'pool-tv':
        return <PoolTV />;
      case 'guestbook':
        return <Guestbook />;
      case 'mixtapes':
        return (
          <div className="h-full flex items-center justify-center text-[hsl(var(--muted-foreground))]">
            <div className="text-center">
              <div className="text-4xl mb-4">🎵</div>
              <p>Mixtapes Player Coming Soon!</p>
            </div>
          </div>
        );
      case 'gallery':
        return (
          <div className="h-full flex items-center justify-center text-[hsl(var(--muted-foreground))]">
            <div className="text-center">
              <div className="text-4xl mb-4">🖼️</div>
              <p>Photo Gallery Coming Soon!</p>
            </div>
          </div>
        );
      case 'x-feed':
        return (
          <div className="h-full flex items-center justify-center text-[hsl(var(--muted-foreground))]">
            <div className="text-center">
              <div className="text-4xl mb-4">🐦</div>
              <p>Social Media Feed Coming Soon!</p>
            </div>
          </div>
        );
      default:
        return (
          <div className="h-full flex items-center justify-center text-[hsl(var(--muted-foreground))]">
            <p>Window content not available</p>
          </div>
        );
    }
  };

  return (
    <div 
      className="min-h-screen desktop-pattern relative overflow-hidden"
      style={{
        backgroundImage: `url(${retroDesktopBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Desktop Overlay Pattern */}
      <div className="absolute inset-0 desktop-pattern opacity-30"></div>

      {/* Welcome Message */}
      {openWindows.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="retro-window bg-[hsl(var(--card))] p-8 max-w-md mx-4">
            <div className="retro-window-header mb-4 -m-2 p-2">
              <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">
                Welcome to Community Retrospective
              </h1>
            </div>
            <div className="space-y-3 text-[hsl(var(--foreground))]">
              <p className="text-sm">
                Step into our retro-inspired digital space! Click the icons in the dock below to explore:
              </p>
              <ul className="text-xs space-y-1 list-disc list-inside text-[hsl(var(--muted-foreground))]">
                <li>🎬 Pool TV - Watch community videos</li>
                <li>📝 Guestbook - Leave your thoughts</li>
                <li>🎵 Mixtapes - Listen to curated music</li>
                <li>📸 Gallery - Browse event photos</li>
                <li>🐦 X Feed - Social media highlights</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Open Windows */}
      {openWindows.map((window) => (
        <RetroWindow
          key={window.id}
          title={window.title}
          onClose={() => closeWindow(window.id)}
          onMinimize={() => minimizeWindow(window.id)}
          isMinimized={window.isMinimized}
          defaultPosition={{ 
            x: 50 + (openWindows.indexOf(window) * 30), 
            y: 50 + (openWindows.indexOf(window) * 30) 
          }}
          defaultSize={{ 
            width: window.type === 'pool-tv' ? 600 : 500, 
            height: window.type === 'pool-tv' ? 450 : 400 
          }}
        >
          {getWindowContent(window.type)}
        </RetroWindow>
      ))}

      {/* Desktop Dock */}
      <DesktopDock onOpenWindow={openWindow} />
    </div>
  );
};

export default Index;
