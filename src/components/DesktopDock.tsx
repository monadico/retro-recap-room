import React from 'react';
import { 
  Tv, 
  MessageSquare, 
  Music, 
  Image, 
  Twitter,
  Monitor,
  Calendar,
  Settings,
  Users
} from 'lucide-react';

interface DockItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

interface DesktopDockProps {
  onOpenWindow: (windowType: string) => void;
}

const DesktopDock: React.FC<DesktopDockProps> = ({ onOpenWindow }) => {
  const dockItems: DockItem[] = [
    {
      id: 'pool-tv',
      label: 'Pool TV',
      icon: <Tv size={24} />,
      onClick: () => onOpenWindow('pool-tv')
    },
    {
      id: 'guestbook',
      label: 'Guestbook',
      icon: <MessageSquare size={24} />,
      onClick: () => onOpenWindow('guestbook')
    },
    {
      id: 'chat',
      label: 'Chat',
      icon: <Users size={24} />,
      onClick: () => onOpenWindow('chat')
    },
    {
      id: 'gallery',
      label: 'The Gallery',
      icon: <Image size={24} />,
      onClick: () => onOpenWindow('gallery')
    },
    {
      id: 'mixtapes',
      label: 'Mixtapes',
      icon: <Music size={24} />,
      onClick: () => onOpenWindow('mixtapes')
    },
    {
      id: 'x-feed',
      label: 'X Feed',
      icon: <Twitter size={24} />,
      onClick: () => onOpenWindow('x-feed')
    },
    {
      id: 'calendar',
      label: 'Events',
      icon: <Calendar size={24} />,
      onClick: () => onOpenWindow('calendar')
    },
    {
      id: 'system',
      label: 'System',
      icon: <Settings size={24} />,
      onClick: () => onOpenWindow('system')
    }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {/* Dock Background */}
      <div className="bg-[hsl(var(--window-bg))] border-t-4 px-4 py-2" style={{ borderStyle: 'outset' }}>
        <div className="flex items-center justify-center space-x-1">
          {dockItems.map((item) => (
            <button
              key={item.id}
              onClick={item.onClick}
              className="retro-button p-3 flex flex-col items-center min-w-[60px] hover:bg-[hsl(var(--button-highlight))] group"
              title={item.label}
            >
              <div className="text-[hsl(var(--foreground))] mb-1">
                {item.icon}
              </div>
              <span className="text-xs font-bold text-[hsl(var(--foreground))] leading-none">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Start Button Style Corner */}
      <div className="absolute bottom-full left-0">
        <div className="retro-button px-4 py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-bold">
          <div className="flex items-center space-x-2">
            <Monitor size={16} />
            <span>Community Retro</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesktopDock;