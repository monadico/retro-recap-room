import React from 'react';
import { LogOut, User } from 'lucide-react';

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
}

interface ProfileProps {
  user: UserProfile;
  onLogout: () => void;
  onClose: () => void;
}

const Profile: React.FC<ProfileProps> = ({ user, onLogout, onClose }) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

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
              <h3 className="text-lg font-bold text-[hsl(var(--foreground))]">
                {user.username}
              </h3>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                #{user.discriminator}
              </p>
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