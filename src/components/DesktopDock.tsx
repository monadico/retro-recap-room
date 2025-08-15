import React, { useState, useEffect } from 'react';
import { 
  Tv, 
  Music, 
  Image, 
  Twitter,
  Monitor,
  Settings,
  Users,
  User
} from 'lucide-react';
import Profile from './Profile';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { config } from '../config/environment';

interface DockItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

interface DesktopDockProps {
  onOpenWindow: (windowType: string) => void;
}

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

const DesktopDock: React.FC<DesktopDockProps> = ({ onOpenWindow }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check authentication status on component mount and after auth success
  useEffect(() => {
    checkAuthStatus();
    
    // Check if we just came back from OAuth
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('auth') === 'success') {
      // Clear the URL parameter
      window.history.replaceState({}, document.title, window.location.pathname);
      // Check auth status multiple times to ensure we catch it
      setTimeout(checkAuthStatus, 1000);
      setTimeout(checkAuthStatus, 2000);
      setTimeout(checkAuthStatus, 5000);
      setTimeout(checkAuthStatus, 10000);
    }
  }, []);

  // Debug: Monitor user state changes
  useEffect(() => {
    console.log('User state changed:', user);
  }, [user]);

  const checkAuthStatus = async () => {
    try {
      console.log('Checking authentication status...');
      console.log('Current cookies:', document.cookie);
      
      const response = await fetch(`${config.apiBase}/auth/user`, {
        credentials: 'include'
      });
      
      console.log('Auth response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (response.ok) {
        const data = await response.json();
        console.log('User data received:', data);
        setUser(data); // Backend now returns user data directly
        console.log('User state set to:', data);
      } else {
        console.log('Auth failed, setting user to null');
        setUser(null);
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setUser(null);
    }
  };

  // Refresh user data when profile modal is closed, so any new wallet link is reflected next time it's opened
  useEffect(() => {
    if (!showProfile) {
      checkAuthStatus();
    }
  }, [showProfile]);

  const handleLogin = async () => {
    try {
      const response = await fetch(`${config.apiBase}/auth/discord`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        window.location.href = data.authUrl;
      } else {
        console.error('Failed to get auth URL');
      }
    } catch (error) {
      console.error('Error during login:', error);
    }
  };

  const handleLogout = async () => {
    try {
      const response = await fetch(`${config.apiBase}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        setUser(null);
        window.location.reload();
      }
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const handleProfileClick = () => {
    if (user) {
      setShowProfile(true);
    } else {
      // Redirect to Discord OAuth
      handleLogin();
    }
  };

  const dockItems: DockItem[] = [
    {
      id: 'pool-tv',
      label: 'Pool TV',
      icon: <Tv size={24} />,
      onClick: () => onOpenWindow('pool-tv')
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
      id: 'the-canva',
      label: 'The Canva',
      icon: <Image size={24} />,
      onClick: () => onOpenWindow('the-canva')
    },
    {
      id: 'system',
      label: 'System',
      icon: <Settings size={24} />,
      onClick: () => onOpenWindow('system')
    },
    {
      id: 'profile',
      label: user ? 'Profile' : 'Login',
      icon: user ? (
        user.avatar ? (
          <img 
            src={user.avatar} 
            alt="Profile" 
            className="w-6 h-6 rounded-full"
          />
        ) : (
          <User size={24} />
        )
      ) : (
        <User size={24} />
      ),
      onClick: handleProfileClick
    }
  ];

  return (
    <>
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

      {/* Profile Modal */}
              {showProfile && user && (
          <Profile
            user={user}
            onLogout={handleLogout}
            onClose={() => setShowProfile(false)}
          />
        )}

        {/* Debug: Manual auth check button */}
        {process.env.NODE_ENV === 'development' && (
          <button
            onClick={checkAuthStatus}
            className="fixed bottom-4 right-4 bg-blue-500 text-white px-3 py-2 rounded text-xs"
            style={{ zIndex: 1000 }}
          >
            🔄 Check Auth
          </button>
        )}
    </>
  );
};

export default DesktopDock;