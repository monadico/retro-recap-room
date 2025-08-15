import React, { useState, useEffect } from 'react';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { ExternalLink, Plus, Trash2, Twitter, Upload, Download, Heart, MessageCircle, Share2, RefreshCw } from 'lucide-react';
import { config } from '../config/environment';

// TypeScript declarations for Twitter widget API
declare global {
  interface Window {
    twttr?: {
      widgets: {
        load: () => void;
      };
    };
  }
}

interface XPost {
  id: string;
  url: string;
  embedHtml: string;
  authorName?: string;
  authorUrl?: string;
  timestamp: string;
  submittedBy?: {
    discordId: string;
    username: string;
    avatar?: string | null;
  };
}

const XFeed: React.FC = () => {
  const [posts, setPosts] = useState<XPost[]>([]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [postUrl, setPostUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [description, setDescription] = useState('');

  // Load X embed script when component mounts
  useEffect(() => {
    // Load X embed script if not already loaded
    if (!window.twttr) {
      const script = document.createElement('script');
      script.src = 'https://platform.twitter.com/widgets.js';
      script.async = true;
      script.charset = 'utf-8';
      document.head.appendChild(script);
    }
  }, []);

  // Function to process X embeds after they're added
  const processXEmbeds = () => {
    if (window.twttr && window.twttr.widgets) {
      window.twttr.widgets.load();
    }
  };

  const fetchXEmbed = async (url: string) => {
    try {
      // Use our backend as a proxy to avoid CORS issues
      const apiBase = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:3001';
      const response = await fetch(`${apiBase}/api/xposts/oembed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url })
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch X embed');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch X embed');
      }

      return {
        html: result.data.html,
        authorName: result.data.authorName,
        authorUrl: result.data.authorUrl,
        width: result.data.width,
        height: result.data.height
      };
    } catch (error) {
      console.error('Error fetching X embed:', error);
      throw new Error('Failed to fetch X post embed');
    }
  };

  const handleAddPost = async () => {
    if (!postUrl.trim()) return;
    
    setIsLoading(true);
    
    try {
      const embedData = await fetchXEmbed(postUrl);

      // Persist to backend
      const apiBase = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:3001';
      const submitRes = await fetch(`${apiBase}/api/xposts/save`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: postUrl,
          embedHtml: embedData.html,
        })
      });
      const saved = await submitRes.json();
      if (!submitRes.ok) throw new Error(saved?.error || 'Failed to save post');

      setPosts(prev => [saved, ...prev]);
      setPostUrl('');
      setShowAddForm(false);
      
      // Process X embeds after adding the post
      setTimeout(() => {
        processXEmbeds();
      }, 100);
    } catch (error) {
      alert('Failed to fetch X post. Please check the URL and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePost = (postId: string) => {
    setPosts(prev => prev.filter(post => post.id !== postId));
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'now';
    if (diffInHours < 24) return `${diffInHours}h`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d`;
    return date.toLocaleDateString();
  };

  // Load persisted posts once
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const response = await fetch(`${config.apiBase}/api/x-feed`);
        if (response.ok) {
          const data = await response.json();
          setPosts(data.posts || []);
        }
      } catch (error) {
        console.error('Error fetching posts:', error);
      }
    };

    fetchPosts();
  }, []);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('post', file);
    if (description) formData.append('description', description);

    try {
      const response = await fetch(`${config.apiBase}/api/x-feed/upload`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setPosts(prev => [data.post, ...prev]);
        setDescription('');
        setMessage('Post uploaded successfully!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Failed to upload post');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      console.error('Error uploading post:', error);
      setMessage('Error uploading post');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleDelete = async (postId: string) => {
    try {
      const response = await fetch(`${config.apiBase}/api/x-feed/${postId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setPosts(prev => prev.filter(p => p.id !== postId));
        setMessage('Post deleted successfully!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Failed to delete post');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      console.error('Error deleting post:', error);
      setMessage('Error deleting post');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[hsl(var(--background))]">
      {/* Header */}
      <div className="retro-window-header p-2 border-b-2 flex justify-between items-center" style={{ borderStyle: 'inset' }}>
        <h3 className="font-bold text-sm text-[hsl(var(--foreground))]">🐦 X Feed</h3>
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          className="retro-button px-2 py-1 text-xs h-auto bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
        >
          <Plus size={12} className="mr-1" />
          Add Post
        </Button>
      </div>

      {/* Add Post Form */}
      {showAddForm && (
        <div className="retro-panel p-3 border-b-2 bg-[hsl(var(--card))]" style={{ borderStyle: 'inset' }}>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-[hsl(var(--foreground))] block mb-1">
                Paste X Post URL:
              </label>
              <Input
                value={postUrl}
                onChange={(e) => setPostUrl(e.target.value)}
                placeholder="https://x.com/username/status/123456789..."
                className="retro-input text-xs"
                disabled={isLoading}
              />
            </div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">
              Paste any X post URL and we'll embed it directly with real images and styling!
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={handleAddPost}
                disabled={!postUrl.trim() || isLoading}
                className="retro-button px-3 py-1 text-xs h-auto bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
              >
                {isLoading ? 'Fetching...' : 'Add Post'}
              </Button>
              <Button
                onClick={() => {
                  setShowAddForm(false);
                  setPostUrl('');
                }}
                className="retro-button px-3 py-1 text-xs h-auto bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Posts Feed */}
      <ScrollArea className="flex-1 retro-scrollbar">
        <div className="p-3 space-y-3">
          {posts.map((post) => (
            <div key={post.id} className="retro-panel p-3 bg-[hsl(var(--card))] border-2" style={{ borderStyle: 'inset' }}>
              {/* Post Header */}
              <div className="flex items-start space-x-2 mb-2">
                <div className="flex-1 flex items-center gap-2">
                  {post.submittedBy?.avatar && (
                    <img src={post.submittedBy.avatar} alt="pfp" className="w-5 h-5 rounded-full" />
                  )}
                  <div className="flex items-center space-x-1">
                    {post.authorName && (
                      <span className="text-xs font-bold text-[hsl(var(--foreground))]">
                        {post.authorName}
                      </span>
                    )}
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                      · {formatTimestamp(post.timestamp)}
                    </span>
                  </div>
                </div>
                <Button
                  onClick={() => handleDeletePost(post.id)}
                  className="retro-button p-1 text-xs h-auto bg-red-300 hover:bg-red-400"
                  title="Delete post"
                >
                  <Trash2 size={10} />
                </Button>
              </div>

              {/* Embedded X Post */}
              <div className="mb-3">
                <div 
                  className="x-embed-container"
                  dangerouslySetInnerHTML={{ __html: post.embedHtml }}
                />
              </div>

              {/* Direct Link */}
              <div className="flex items-center justify-between mt-2">
                <a
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-800 underline flex items-center"
                >
                  <ExternalLink size={10} className="mr-1" />
                  View on X
                </a>
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  {post.url}
                </span>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default XFeed; 