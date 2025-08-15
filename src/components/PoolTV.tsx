import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, Upload, Trash2, Plus } from 'lucide-react';
import { config } from '../config/environment';

interface UserProfile {
  discordId: string;
  username: string;
}

interface VideoItem {
  id: string;
  url: string;
  title: string;
  description: string;
  uploadedAt: string;
  uploadedBy: string;
}

const PoolTV: React.FC = () => {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showUpload, setShowUpload] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [canUpload, setCanUpload] = useState(false);
  const [message, setMessage] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
    const u = await fetch(`${config.apiBase}/auth/user`, { credentials: 'include' });
        if (u.ok) {
          const data = await u.json();
          setUser({ discordId: data.discordId, username: data.username });
        } else {
          setUser(null);
        }
    const p = await fetch(`${config.apiBase}/api/upload-permissions`, { credentials: 'include' });
        if (p.ok) {
          const pdata = await p.json();
          setCanUpload(!!pdata.canUpload);
        } else {
          setCanUpload(false);
        }
      } catch (e) {
        setUser(null);
        setCanUpload(false);
      }
    };
    load();
  }, []);

  // Fetch videos on component mount
  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const response = await fetch(`${config.apiBase}/api/videos`);
        if (response.ok) {
          const data = await response.json();
          setVideos(data.videos || []);
          if (data.videos && data.videos.length > 0) {
            setCurrentIndex(0);
          }
        }
      } catch (error) {
        console.error('Error fetching videos:', error);
      }
    };

    fetchVideos();
  }, []);

  const currentVideo = useMemo(() => videos[currentIndex], [videos, currentIndex]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) videoRef.current.volume = newVolume;
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  };
  const handleLoadedMetadata = () => {
    if (videoRef.current) setDuration(videoRef.current.duration);
  };
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (videoRef.current) videoRef.current.currentTime = newTime;
  };
  const skipBackward = () => {
    if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
  };
  const skipForward = () => {
    if (videoRef.current) videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 10);
  };
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const onChooseFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setFile(e.target.files[0]);
  };

  const uploadVideo = async () => {
    if (!file) return;
    const form = new FormData();
    form.append('video', file);
    if (title) form.append('title', title);
    if (description) form.append('description', description);
  const apiBase = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:3001';
  const res = await fetch(`${config.apiBase}/api/videos`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    if (res.ok) {
      setShowUpload(false);
      setFile(null);
      setTitle('');
      setDescription('');
      await fetchVideos();
    } else {
      const err = await res.json().catch(() => ({} as any));
      alert(err.error || 'Failed to upload video');
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('video', file);

    try {
      const response = await fetch(`${config.apiBase}/api/upload-video`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setVideos(prev => [...prev, data.video]);
        setMessage('Video uploaded successfully!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Failed to upload video');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      console.error('Error uploading video:', error);
      setMessage('Error uploading video');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleDelete = async (videoId: string) => {
    try {
      const response = await fetch(`${config.apiBase}/api/videos/${videoId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setVideos(prev => prev.filter(v => v.id !== videoId));
        if (currentIndex >= videos.length - 1) {
          setCurrentIndex(Math.max(0, videos.length - 2));
        }
        setMessage('Video deleted successfully!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Failed to delete video');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      console.error('Error deleting video:', error);
      setMessage('Error deleting video');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <div className="h-full flex bg-black">
      {/* Sidebar list */}
      <div className="w-72 border-r border-gray-700 p-3 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold">Playlist</h3>
          {canUpload && (
            <button className="retro-button px-2 py-1 flex items-center gap-1" onClick={() => setShowUpload(true)}>
              <Plus size={16} /> Upload
            </button>
          )}
        </div>
        {videos.length === 0 ? (
          <div className="text-gray-400 text-sm">
            No videos available.
            <div className="mt-2">
              {user ? (
                canUpload ? 'Use the Upload button to add the first video.' : 'You do not have permission to upload.'
              ) : (
                'Login to upload videos.'
              )}
            </div>
          </div>
        ) : (
          <ul className="space-y-2">
            {videos.map((v, idx) => (
              <li key={v.id} className={`p-2 rounded cursor-pointer ${idx === currentIndex ? 'bg-gray-800' : 'hover:bg-gray-900'}`} onClick={() => setCurrentIndex(idx)}>
                <div className="text-white text-sm font-semibold">{v.title}</div>
                <div className="text-gray-400 text-xs">Uploaded {new Date(v.uploadedAt).toLocaleString()}</div>
                {user && v.uploadedBy === user.discordId && (
                  <button className="mt-1 text-xs text-red-400 hover:text-red-300" onClick={(e) => { e.stopPropagation(); handleDelete(v.id); }}>
                    <Trash2 className="inline mr-1" size={14} /> Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Player */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 relative bg-black border-2 border-gray-600" style={{ borderStyle: 'inset' }}>
          {currentVideo ? (
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              src={`${config.apiBase}${currentVideo.url}`}
              controls={false}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500">No video selected</div>
          )}
        </div>

        {/* Controls */}
        <div className="bg-[hsl(var(--button-face))] p-3 border-t-2" style={{ borderStyle: 'outset' }}>
          {/* Progress Bar */}
          <div className="mb-3">
            <input type="range" min="0" max={duration} value={currentTime} onChange={handleSeek} className="w-full retro-input h-2" />
            <div className="flex justify-between text-xs mt-1 text-[hsl(var(--muted-foreground))]">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-center space-x-2">
            <button onClick={skipBackward} className="retro-button p-2">
              <SkipBack size={16} />
            </button>
            <button onClick={togglePlay} className="retro-button p-3 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <button onClick={skipForward} className="retro-button p-2">
              <SkipForward size={16} />
            </button>
            <div className="flex items-center gap-2 ml-4">
              <Volume2 size={16} className="text-[hsl(var(--muted-foreground))]" />
              <input type="range" min="0" max="1" step="0.1" value={volume} onChange={handleVolumeChange} className="retro-input w-24 h-2" />
            </div>
          </div>
        </div>
      </div>

      {/* Upload modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[hsl(var(--window-bg))] p-4 w-[420px] border-2" style={{ borderStyle: 'outset' }}>
            <div className="text-lg font-bold mb-2">Upload Video</div>
            <div className="space-y-2">
              <input className="retro-input w-full" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <textarea className="retro-input w-full" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
              <input type="file" accept="video/*" onChange={onChooseFile} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="retro-button px-3 py-2" onClick={() => setShowUpload(false)}>Cancel</button>
              <button className="retro-button px-3 py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]" onClick={uploadVideo} disabled={!file}>Upload</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PoolTV;