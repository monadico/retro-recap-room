import React, { useState } from 'react';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Heart, MessageCircle, Send } from 'lucide-react';

interface Comment {
  id: string;
  user: string;
  text: string;
  timestamp: Date;
}

interface Photo {
  id: string;
  url: string;
  title: string;
  description: string;
  likes: number;
  comments: Comment[];
  likedByUser: boolean;
}

const Gallery: React.FC = () => {
  const [photos, setPhotos] = useState<Photo[]>([
    {
      id: '1',
      url: 'https://images.unsplash.com/photo-1519389950473-47ba02257781',
      title: 'Team Collaboration Session',
      description: 'Great brainstorming session with the team',
      likes: 12,
      comments: [
        {
          id: '1',
          user: 'Sarah',
          text: 'Love this energy! 🔥',
          timestamp: new Date('2024-01-15T10:30:00')
        }
      ],
      likedByUser: false
    },
    {
      id: '2',
      url: 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81',
      title: 'Presentation Setup',
      description: 'Setting up for the main presentation',
      likes: 8,
      comments: [],
      likedByUser: true
    },
    {
      id: '3',
      url: 'https://images.unsplash.com/photo-1488590528505-98d2b5baba04b',
      title: 'Development Work',
      description: 'Working on the latest features',
      likes: 15,
      comments: [
        {
          id: '1',
          user: 'Mike',
          text: 'The code looks great!',
          timestamp: new Date('2024-01-15T11:00:00')
        },
        {
          id: '2',
          user: 'Alex',
          text: 'Ready for deployment?',
          timestamp: new Date('2024-01-15T11:15:00')
        }
      ],
      likedByUser: false
    }
  ]);

  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [username, setUsername] = useState('Anonymous');

  const handleLike = (photoId: string) => {
    setPhotos(prev => prev.map(photo => {
      if (photo.id === photoId) {
        return {
          ...photo,
          likes: photo.likedByUser ? photo.likes - 1 : photo.likes + 1,
          likedByUser: !photo.likedByUser
        };
      }
      return photo;
    }));
  };

  const handleComment = (photoId: string) => {
    if (newComment.trim()) {
      const comment: Comment = {
        id: Date.now().toString(),
        user: username,
        text: newComment.trim(),
        timestamp: new Date()
      };
      
      setPhotos(prev => prev.map(photo => {
        if (photo.id === photoId) {
          return {
            ...photo,
            comments: [...photo.comments, comment]
          };
        }
        return photo;
      }));
      setNewComment('');
    }
  };

  const selectedPhotoData = photos.find(p => p.id === selectedPhoto);

  return (
    <div className="h-full flex bg-[hsl(var(--background))]">
      {/* Photo Grid */}
      <div className="w-1/2 border-r-2" style={{ borderStyle: 'inset' }}>
        <div className="retro-window-header p-2 border-b-2" style={{ borderStyle: 'inset' }}>
          <h3 className="font-bold text-sm text-[hsl(var(--foreground))]">📸 Photo Gallery</h3>
        </div>
        <ScrollArea className="h-full p-4">
          <div className="grid grid-cols-2 gap-3">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className={`retro-panel cursor-pointer transition-all ${
                  selectedPhoto === photo.id ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--card))]'
                }`}
                onClick={() => setSelectedPhoto(photo.id)}
              >
                <img
                  src={photo.url}
                  alt={photo.title}
                  className="w-full h-20 object-cover border-2"
                  style={{ borderStyle: 'inset' }}
                />
                <div className="p-2">
                  <h4 className="text-xs font-bold text-[hsl(var(--foreground))] truncate">
                    {photo.title}
                  </h4>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                      ❤️ {photo.likes}
                    </span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                      💬 {photo.comments.length}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Photo Detail */}
      <div className="w-1/2 flex flex-col">
        {selectedPhotoData ? (
          <>
            {/* Photo Display */}
            <div className="retro-window-header p-2 border-b-2" style={{ borderStyle: 'inset' }}>
              <h3 className="font-bold text-sm text-[hsl(var(--foreground))]">
                {selectedPhotoData.title}
              </h3>
            </div>
            
            <div className="p-3">
              <img
                src={selectedPhotoData.url}
                alt={selectedPhotoData.title}
                className="w-full h-32 object-cover border-2 mb-2"
                style={{ borderStyle: 'inset' }}
              />
              <p className="text-xs text-[hsl(var(--foreground))] mb-3">
                {selectedPhotoData.description}
              </p>
              
              {/* Like and Comment Actions */}
              <div className="flex items-center space-x-2 mb-3">
                <Button
                  onClick={() => handleLike(selectedPhotoData.id)}
                  className={`retro-button px-2 py-1 text-xs h-auto ${
                    selectedPhotoData.likedByUser 
                      ? 'bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]' 
                      : 'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]'
                  }`}
                >
                  <Heart size={12} className="mr-1" />
                  {selectedPhotoData.likes}
                </Button>
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  <MessageCircle size={12} className="inline mr-1" />
                  {selectedPhotoData.comments.length} comments
                </span>
              </div>
            </div>

            {/* Comments Section */}
            <ScrollArea className="flex-1 px-3">
              <div className="space-y-2">
                {selectedPhotoData.comments.map((comment) => (
                  <div key={comment.id} className="retro-panel p-2 bg-[hsl(var(--card))]">
                    <div className="flex items-start space-x-2">
                      <div className="text-xs font-bold text-[hsl(var(--primary))]">
                        {comment.user}:
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-[hsl(var(--foreground))]">
                          {comment.text}
                        </p>
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">
                          {comment.timestamp.toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Comment Input */}
            <div className="retro-window-header p-2 border-t-2" style={{ borderStyle: 'inset' }}>
              <div className="flex items-center space-x-2 mb-2">
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="text-xs h-6 w-20 retro-input"
                  placeholder="Name"
                />
              </div>
              <div className="flex space-x-2">
                <Input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleComment(selectedPhotoData.id)}
                  placeholder="Add a comment..."
                  className="flex-1 retro-input text-xs"
                />
                <Button
                  onClick={() => handleComment(selectedPhotoData.id)}
                  className="retro-button px-2 py-1 h-auto bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                >
                  <Send size={12} />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[hsl(var(--muted-foreground))]">
            <div className="text-center">
              <div className="text-4xl mb-4">📸</div>
              <p>Select a photo to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Gallery;