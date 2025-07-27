import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Send, User } from 'lucide-react';

interface ChatMessage {
  id: string;
  user: string;
  message: string;
  timestamp: Date;
}

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      user: 'Alex',
      message: 'Great meeting today! Really loved the new initiative discussion.',
      timestamp: new Date('2024-01-15T10:30:00')
    },
    {
      id: '2',
      user: 'Sarah',
      message: 'The presentation slides were really clear. Thanks for sharing!',
      timestamp: new Date('2024-01-15T10:32:00')
    },
    {
      id: '3',
      user: 'Mike',
      message: 'Looking forward to implementing these ideas in Q2.',
      timestamp: new Date('2024-01-15T10:35:00')
    }
  ]);
  const [newMessage, setNewMessage] = useState('');
  const [username, setUsername] = useState('Anonymous');

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      const message: ChatMessage = {
        id: Date.now().toString(),
        user: username,
        message: newMessage.trim(),
        timestamp: new Date()
      };
      setMessages(prev => [...prev, message]);
      setNewMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  return (
    <div className="h-full flex flex-col bg-[hsl(var(--background))]">
      {/* Chat Header */}
      <div className="retro-window-header p-3 border-b-2" style={{ borderStyle: 'inset' }}>
        <div className="flex items-center space-x-2">
          <User size={16} className="text-[hsl(var(--foreground))]" />
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="text-xs h-6 w-24 retro-input"
            placeholder="Your name"
          />
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {messages.map((msg) => (
            <div key={msg.id} className="retro-panel p-3 bg-[hsl(var(--card))]">
              <div className="flex items-start space-x-2">
                <div className="retro-button p-1 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
                  <User size={12} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-bold text-xs text-[hsl(var(--foreground))]">
                      {msg.user}
                    </span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                      {msg.timestamp.toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-[hsl(var(--foreground))]">
                    {msg.message}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className="retro-window-header p-3 border-t-2" style={{ borderStyle: 'inset' }}>
        <div className="flex space-x-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            className="flex-1 retro-input text-sm"
          />
          <Button
            onClick={handleSendMessage}
            className="retro-button px-3 py-1 h-auto bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
          >
            <Send size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Chat;