import React, { useState } from 'react';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';

interface XPost {
  id: string;
  author: {
    name: string;
    handle: string;
    avatar: string;
    verified: boolean;
  };
  content: string;
  image?: string;
  timestamp: string;
  engagement: {
    likes: number;
    comments: number;
    reposts: number;
    views: number;
  };
  url: string;
  liked: boolean;
  reposted: boolean;
}

const XFeed: React.FC = () => {
  const [posts, setPosts] = useState<XPost[]>([
    {
      id: '1',
      author: {
        name: 'Community Event',
        handle: '@community_event',
        avatar: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=50&h=50&fit=crop',
        verified: true
      },
      content: 'Amazing turnout at our latest meetup! 🎉 The energy was incredible and the discussions were mind-blowing. Can\'t wait for the next one! #Community #Innovation',
      image: 'https://images.unsplash.com/photo-1519389950473-47ba02257781?w=400&h=300&fit=crop',
      timestamp: '2024-01-15T10:30:00.000Z',
      engagement: {
        likes: 127,
        comments: 23,
        reposts: 15,
        views: 2047
      },
      url: 'https://x.com/community_event/status/123456789',
      liked: false,
      reposted: false
    },
    {
      id: '2',
      author: {
        name: 'Tech Speaker',
        handle: '@tech_speaker',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=50&h=50&fit=crop',
        verified: false
      },
      content: 'Just wrapped up an incredible session on the future of web development. The questions from the audience were fantastic! Thanks everyone for the great discussion.',
      timestamp: '2024-01-15T09:15:00.000Z',
      engagement: {
        likes: 89,
        comments: 12,
        reposts: 8,
        views: 1234
      },
      url: 'https://x.com/tech_speaker/status/123456788',
      liked: true,
      reposted: false
    },
    {
      id: '3',
      author: {
        name: 'Event Organizer',
        handle: '@event_org',
        avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=50&h=50&fit=crop',
        verified: true
      },
      content: 'Behind the scenes: Setting up for tomorrow\'s big event! The venue is looking perfect and we\'re so excited to see everyone. Don\'t forget to bring your energy! ⚡',
      image: 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81?w=400&h=300&fit=crop',
      timestamp: '2024-01-14T16:45:00.000Z',
      engagement: {
        likes: 234,
        comments: 45,
        reposts: 32,
        views: 3456
      },
      url: 'https://x.com/event_org/status/123456787',
      liked: false,
      reposted: true
    }
  ]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [postUrl, setPostUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);



  const extractPostData = async (url: string) => {
    try {
      const response = await fetch('http://localhost:3001/api/xposts/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url })
      });

      if (!response.ok) {
        throw new Error('Failed to extract post data');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to extract post data');
      }

      return result.data;
    } catch (error) {
      console.error('Error extracting post data:', error);
      throw new Error('Failed to extract post data from URL');
    }
  };

  const handleAddPost = async () => {
    if (!postUrl.trim()) return;
    
    setIsLoading(true);
    
    try {
      const postData = await extractPostData(postUrl);
      
      const post: XPost = {
        id: Date.now().toString(),
        author: postData.author,
        content: postData.content,
        image: postData.image,
        timestamp: new Date().toISOString(),
        engagement: {
          likes: 0,
          comments: 0,
          reposts: 0,
          views: 0
        },
        url: postUrl,
        liked: false,
        reposted: false
      };

      setPosts(prev => [post, ...prev]);
      setPostUrl('');
      setShowAddForm(false);
    } catch (error) {
      alert('Failed to extract post data. Please check the URL and try again.');
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

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
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
              Just paste the X post URL and we'll automatically extract the content, author, and images!
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={handleAddPost}
                disabled={!postUrl.trim() || isLoading}
                className="retro-button px-3 py-1 text-xs h-auto bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
              >
                {isLoading ? 'Processing...' : 'Add Post'}
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
                <img
                  src={post.author.avatar}
                  alt={post.author.name}
                  className="w-8 h-8 rounded-full border-2"
                  style={{ borderStyle: 'inset' }}
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-1">
                    <span className="text-xs font-bold text-[hsl(var(--foreground))]">
                      {post.author.name}
                    </span>
                    {post.author.verified && (
                      <span className="text-blue-500 text-xs">✓</span>
                    )}
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                      {post.author.handle}
                    </span>
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

              {/* Post Content */}
              <div className="mb-3">
                <p className="text-xs text-[hsl(var(--foreground))] leading-relaxed">
                  {post.content}
                </p>
              </div>

              {/* Post Image */}
              {post.image && (
                <div className="mb-3">
                  <img
                    src={post.image}
                    alt="Post content"
                    className="w-full max-h-48 object-cover border-2 rounded"
                    style={{ borderStyle: 'inset' }}
                  />
                </div>
              )}

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