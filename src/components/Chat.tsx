import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Send, User } from 'lucide-react';

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  avatar: string | null;
  message: string;
  timestamp: number;
}

interface ChatUser {
  userId: string;
  username: string;
  avatar: string | null;
  joinedAt: string;
}

const ChatComponent: React.FC = () => {
  const [newMessage, setNewMessage] = useState('');
  const [user, setUser] = useState<any>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connectedUsers, setConnectedUsers] = useState<ChatUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check authentication on component mount
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const apiBase = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:3001';
        const response = await fetch(`${apiBase}/auth/user`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.log('User not authenticated');
        setUser(null);
      }
    };

    checkAuthStatus();
  }, []);

  // WebSocket connection
  useEffect(() => {
    if (!user) return;

    const connectWebSocket = () => {
      const ws = new WebSocket('ws://localhost:3001');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('🔌 WebSocket connected');
        setIsConnected(true);
        
        // Send user join message
        ws.send(JSON.stringify({
          type: 'user_join',
          userId: user.discordId,
          username: user.username,
          avatar: user.avatar
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'chat_data':
              setMessages(data.messages || []);
              setConnectedUsers(data.users || []);
              break;
              
            case 'new_message':
              setMessages(prev => [...prev, data.message]);
              break;
              
            case 'user_joined':
              setConnectedUsers(prev => {
                const exists = prev.find(u => u.userId === data.userId);
                if (!exists) {
                  return [...prev, {
                    userId: data.userId,
                    username: data.username,
                    avatar: data.avatar,
                    joinedAt: new Date().toISOString()
                  }];
                }
                return prev;
              });
              break;
              
            case 'user_left':
              setConnectedUsers(prev => prev.filter(u => u.userId !== data.userId));
              break;
              
            case 'typing_start':
              setTypingUsers(prev => new Set([...prev, data.username]));
              break;
              
            case 'typing_stop':
              setTypingUsers(prev => {
                const newSet = new Set(prev);
                newSet.delete(data.username);
                return newSet;
              });
              break;
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        setIsConnected(false);
        setConnectedUsers([]);
        
        // Try to reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };
    };

    connectWebSocket();

    // Cleanup on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [user]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !user || !isConnected) return;

    const messageData = {
      type: 'chat_message',
      userId: user.discordId,
      username: user.username,
      avatar: user.avatar,
      message: newMessage.trim()
    };

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(messageData));
      setNewMessage('');
      
      // Stop typing indicator
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'typing_stop',
          userId: user.discordId,
          username: user.username
        }));
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    } else if (e.key !== 'Shift') {
      // Send typing indicator
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !isTyping) {
        setIsTyping(true);
        wsRef.current.send(JSON.stringify({
          type: 'typing_start',
          userId: user.discordId,
          username: user.username
        }));
        
        // Clear typing indicator after 2 seconds
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'typing_stop',
              userId: user.discordId,
              username: user.username
            }));
          }
          setIsTyping(false);
        }, 2000);
      }
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getAvatarUrl = (avatar: string | null, discordId: string) => {
    if (avatar) {
      return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png`;
    }
    return null;
  };

  return (
    <div className="h-full flex flex-col bg-[hsl(var(--background))]">
      {/* Chat Header */}
      <div className="retro-window-header p-3 border-b-2" style={{ borderStyle: 'inset' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {user?.avatar ? (
              <img 
                src={getAvatarUrl(user.avatar, user.discordId)} 
                alt="Profile" 
                className="w-6 h-6 rounded-full border-2 border-[hsl(var(--border))]"
              />
            ) : (
              <User size={16} className="text-[hsl(var(--foreground))]" />
            )}
            <span className="text-sm text-[hsl(var(--foreground))]">
              Chatting as: <span className="font-bold text-[hsl(var(--primary))]">{user?.username || 'Anonymous'}</span>
            </span>
          </div>
          <div className="flex items-center space-x-2 text-xs text-[hsl(var(--muted-foreground))]">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>{isConnected ? `Connected (${connectedUsers.length} users)` : 'Connecting...'}</span>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {messages.length === 0 ? (
            <div className="text-center text-[hsl(var(--muted-foreground))] py-8">
              <div className="text-4xl mb-2">💬</div>
              <p className="text-sm">No messages yet. Start the conversation!</p>
              <p className="text-xs mt-2">Real-time WebSocket chat - messages visible to all users!</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="retro-panel p-3 bg-[hsl(var(--card))]">
                <div className="flex items-start space-x-2">
                  {getAvatarUrl(msg.avatar, msg.userId) ? (
                    <img 
                      src={getAvatarUrl(msg.avatar, msg.userId)} 
                      alt="Profile" 
                      className="w-6 h-6 rounded-full border border-[hsl(var(--border))]"
                    />
                  ) : (
                    <div className="retro-button p-1 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
                      <User size={12} />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-bold text-xs text-[hsl(var(--foreground))]">
                        {msg.username}
                      </span>
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">
                        {formatTimestamp(msg.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-[hsl(var(--foreground))]">
                      {msg.message}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
          
          {/* Typing indicators */}
          {typingUsers.size > 0 && (
            <div className="text-xs text-[hsl(var(--muted-foreground))] italic">
              {Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Message Input */}
      {user ? (
        <div className="retro-window-header p-3 border-t-2" style={{ borderStyle: 'inset' }}>
          <div className="flex space-x-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="flex-1 retro-input text-sm"
              disabled={!isConnected}
            />
            <Button
              onClick={handleSendMessage}
              className="retro-button px-3 py-1 h-auto bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
              disabled={!newMessage.trim() || !isConnected}
            >
              <Send size={16} />
            </Button>
          </div>
        </div>
      ) : (
        <div className="retro-window-header p-3 border-t-2" style={{ borderStyle: 'inset' }}>
          <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
            <User size={12} />
            Login with Discord to join the chat
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatComponent;