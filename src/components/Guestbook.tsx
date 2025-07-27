import React, { useState } from 'react';
import { MessageSquare, User, Clock } from 'lucide-react';

interface GuestbookEntry {
  id: number;
  name: string;
  message: string;
  timestamp: Date;
  avatar?: string;
}

const Guestbook: React.FC = () => {
  const [entries, setEntries] = useState<GuestbookEntry[]>([
    {
      id: 1,
      name: "PoolsideFan",
      message: "This retrospective is absolutely amazing! The 90s vibes are perfect 🌊",
      timestamp: new Date('2024-01-15T14:30:00'),
    },
    {
      id: 2,
      name: "RetroLover",
      message: "Loving this throwback aesthetic! Takes me back to the good old days of computing.",
      timestamp: new Date('2024-01-15T15:15:00'),
    },
    {
      id: 3,
      name: "CommunityMember",
      message: "Great meeting everyone! Can't wait for the next one. This format is so creative.",
      timestamp: new Date('2024-01-15T16:00:00'),
    }
  ]);

  const [newEntry, setNewEntry] = useState({ name: '', message: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newEntry.name.trim() && newEntry.message.trim()) {
      const entry: GuestbookEntry = {
        id: entries.length + 1,
        name: newEntry.name.trim(),
        message: newEntry.message.trim(),
        timestamp: new Date(),
      };
      setEntries([entry, ...entries]);
      setNewEntry({ name: '', message: '' });
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="h-full flex flex-col bg-[hsl(var(--card))]">
      {/* Header */}
      <div className="bg-[hsl(var(--window-header))] p-3 border-b-2" style={{ borderStyle: 'inset' }}>
        <div className="flex items-center space-x-2">
          <MessageSquare size={20} className="text-[hsl(var(--primary))]" />
          <h2 className="text-lg font-bold text-[hsl(var(--foreground))]">Community Guestbook</h2>
        </div>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Leave your thoughts about our community retrospective!
        </p>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {entries.map((entry) => (
          <div key={entry.id} className="bg-[hsl(var(--muted))] p-3 border-2" style={{ borderStyle: 'inset' }}>
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-[hsl(var(--primary))] rounded border-2" style={{ borderStyle: 'outset' }}>
                <div className="w-full h-full flex items-center justify-center">
                  <User size={16} className="text-[hsl(var(--primary-foreground))]" />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="font-bold text-[hsl(var(--foreground))]">
                    {entry.name}
                  </span>
                  <div className="flex items-center space-x-1 text-xs text-[hsl(var(--muted-foreground))]">
                    <Clock size={12} />
                    <span>{formatTime(entry.timestamp)}</span>
                  </div>
                </div>
                <p className="text-[hsl(var(--foreground))] text-sm leading-relaxed">
                  {entry.message}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input Form */}
      <div className="border-t-2 p-3 bg-[hsl(var(--window-bg))]" style={{ borderStyle: 'outset' }}>
        <form onSubmit={handleSubmit} className="space-y-2">
          <div>
            <label className="block text-sm font-bold text-[hsl(var(--foreground))] mb-1">
              Your Name:
            </label>
            <input
              type="text"
              value={newEntry.name}
              onChange={(e) => setNewEntry({ ...newEntry, name: e.target.value })}
              className="retro-input w-full text-sm"
              placeholder="Enter your name..."
              maxLength={50}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-[hsl(var(--foreground))] mb-1">
              Message:
            </label>
            <textarea
              value={newEntry.message}
              onChange={(e) => setNewEntry({ ...newEntry, message: e.target.value })}
              className="retro-input w-full text-sm h-16 resize-none"
              placeholder="Share your thoughts..."
              maxLength={200}
            />
          </div>
          <button
            type="submit"
            className="retro-button bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-bold"
            disabled={!newEntry.name.trim() || !newEntry.message.trim()}
          >
            Sign Guestbook
          </button>
        </form>
      </div>
    </div>
  );
};

export default Guestbook;