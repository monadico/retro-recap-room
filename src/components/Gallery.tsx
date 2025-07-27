import React, { useState, useEffect } from 'react';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Heart, MessageCircle, Send, Upload, Plus } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Comment {
  id: string;
  user: string;
  text: string;
  timestamp: string;
}

interface Photo {
  id: string;
  url: string;
  title: string;
  description: string;
  likes: number;
  comments: Comment[];
  likedByUser: boolean;
  uploadedAt: string;
}

// API base URL - change this to your VPS URL when deploying
const API_BASE_URL = 'http://localhost:3001/api';
const BACKEND_BASE_URL = 'http://localhost:3001';

// API functions
const fetchPhotos = async (): Promise<Photo[]> => {
  const response = await fetch(`${API_BASE_URL}/photos`);
  if (!response.ok) {
    throw new Error('Failed to fetch photos');
  }
  return response.json();
};

const likePhoto = async (photoId: string): Promise<Photo> => {
  const response = await fetch(`${API_BASE_URL}/photos/${photoId}/like`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to like photo');
  }
  return response.json();
};

const addComment = async ({ photoId, user, text }: { photoId: string; user: string; text: string }): Promise<Comment> => {
  const response = await fetch(`${API_BASE_URL}/photos/${photoId}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user, text }),
  });
  if (!response.ok) {
    throw new Error('Failed to add comment');
  }
  return response.json();
};

const Gallery: React.FC = () => {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [username, setUsername] = useState('Anonymous');
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const queryClient = useQueryClient();

  // Fetch photos
  const { data: photos = [], isLoading, error } = useQuery({
    queryKey: ['photos'],
    queryFn: fetchPhotos,
  });

  // Like photo mutation
  const likeMutation = useMutation({
    mutationFn: likePhoto,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos'] });
    },
  });

  // Add comment mutation
  const commentMutation = useMutation({
    mutationFn: addComment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos'] });
      setNewComment('');
    },
  });

  const handleLike = (photoId: string) => {
    likeMutation.mutate(photoId);
  };

  const handleComment = (photoId: string) => {
    if (newComment.trim() && username.trim()) {
      commentMutation.mutate({
        photoId,
        user: username.trim(),
        text: newComment.trim(),
      });
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !uploadTitle.trim()) return;

    const formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('title', uploadTitle);
    formData.append('description', uploadDescription);

    try {
      const response = await fetch(`${API_BASE_URL}/photos`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['photos'] });
        setShowUploadForm(false);
        setSelectedFile(null);
        setUploadTitle('');
        setUploadDescription('');
      }
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  const selectedPhotoData = photos.find(p => p.id === selectedPhoto);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">📸</div>
          <p>Loading photos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <p>Failed to load photos. Please check your connection.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-[hsl(var(--background))]">
      {/* Photo Grid */}
      <div className="w-1/2 border-r-2" style={{ borderStyle: 'inset' }}>
        <div className="retro-window-header p-2 border-b-2 flex justify-between items-center" style={{ borderStyle: 'inset' }}>
          <h3 className="font-bold text-sm text-[hsl(var(--foreground))]">📸 Photo Gallery</h3>
          <Button
            onClick={() => setShowUploadForm(!showUploadForm)}
            className="retro-button px-2 py-1 text-xs h-auto bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
          >
            <Plus size={12} className="mr-1" />
            Upload
          </Button>
        </div>

        {/* Upload Form */}
        {showUploadForm && (
          <div className="retro-panel p-3 border-b-2 bg-[hsl(var(--card))]" style={{ borderStyle: 'inset' }}>
            <div className="space-y-2">
              <Input
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="Photo title..."
                className="retro-input text-xs"
              />
              <Input
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="Photo description..."
                className="retro-input text-xs"
              />
              <div className="flex items-center space-x-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="retro-input text-xs"
                />
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || !uploadTitle.trim()}
                  className="retro-button px-2 py-1 text-xs h-auto bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                >
                  <Upload size={12} />
                </Button>
              </div>
            </div>
          </div>
        )}

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
                  src={photo.url.startsWith('http') ? photo.url : `${BACKEND_BASE_URL}${photo.url}`}
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
            
            {/* Scrollable content area */}
            <div className="flex-1 overflow-auto retro-scrollbar">
              <div className="p-3 space-y-4">
                {/* Full-size image display */}
                <div className="flex items-center justify-center">
                  <img
                    src={selectedPhotoData.url.startsWith('http') ? selectedPhotoData.url : `${BACKEND_BASE_URL}${selectedPhotoData.url}`}
                    alt={selectedPhotoData.title}
                    className="max-w-full border-2 object-contain"
                    style={{ borderStyle: 'inset' }}
                  />
                </div>
                
                {/* Photo description */}
                <div className="retro-panel p-3 bg-[hsl(var(--card))]">
                  <p className="text-xs text-[hsl(var(--foreground))]">
                    {selectedPhotoData.description}
                  </p>
                </div>
              
                {/* Like and Comment Actions */}
                <div className="flex items-center space-x-2">
                  <Button
                    onClick={() => handleLike(selectedPhotoData.id)}
                    disabled={likeMutation.isPending}
                    className="retro-button px-2 py-1 text-xs h-auto bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]"
                  >
                    <Heart size={12} className="mr-1" />
                    {selectedPhotoData.likes}
                  </Button>
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    <MessageCircle size={12} className="inline mr-1" />
                    {selectedPhotoData.comments.length} comments
                  </span>
                </div>

                {/* Comments Section */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-[hsl(var(--foreground))] border-b-2 pb-1" style={{ borderStyle: 'inset' }}>
                    Comments
                  </h4>
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
                            {new Date(comment.timestamp).toLocaleTimeString([], { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Comment Input - Fixed at bottom */}
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
                  disabled={commentMutation.isPending}
                />
                <Button
                  onClick={() => handleComment(selectedPhotoData.id)}
                  disabled={commentMutation.isPending || !newComment.trim()}
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