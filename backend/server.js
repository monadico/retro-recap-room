require("dotenv").config({ override: true });
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const session = require('express-session');
const FileStoreFactory = require('session-file-store');
const passport = require('passport');

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure session storage directory exists (for file-based sessions)
const sessionsDir = path.join(__dirname, '.sessions');
if (!fs.existsSync(sessionsDir)) {
  fs.mkdirSync(sessionsDir, { recursive: true });
}

// Middleware
const resolveFrontendOrigin = () => process.env.FRONTEND_ORIGIN || 'http://localhost:8080';
console.log('[server] FRONTEND_ORIGIN (initial) =', resolveFrontendOrigin());
const allowedOrigins = [resolveFrontendOrigin(), 'http://localhost:8080', 'http://127.0.0.1:8080'];
app.use((req, res, next) => {
  const requestOrigin = req.headers.origin;
  const originToUse = allowedOrigins.includes(requestOrigin) ? requestOrigin : resolveFrontendOrigin();
  res.header('Access-Control-Allow-Origin', originToUse);
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  return next();
});
app.use(express.json());
app.use(express.static(path.join(__dirname, 'uploads')));

// Session middleware
const FileStore = FileStoreFactory(session);
const sessionStore = new FileStore({
  path: sessionsDir,
  fileExtension: '.json',
  retries: 1,
  logFn: function () {},
});

app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'change_this_session_secret_in_production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax',
    path: '/',
  },
}));

// Passport Discord strategy
const DiscordStrategy = require('passport-discord').Strategy;

passport.use(
  new DiscordStrategy(
    {
      clientID: process.env.DISCORD_CLIENT_ID || 'your_discord_client_id',
      clientSecret: process.env.DISCORD_CLIENT_SECRET || 'your_discord_client_secret',
      callbackURL: process.env.DISCORD_REDIRECT_URI || 'http://localhost:3001/auth/discord/callback',
      scope: ['identify', 'email'],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const userRecord = {
          discordId: profile.id,
          username: profile.username,
          discriminator: profile.discriminator,
          avatar: profile.avatar,
          email: profile.email,
          lastLogin: new Date().toISOString(),
        };
        
        // Save user to users-data.json
        const users = JSON.parse(fs.readFileSync(path.join(__dirname, 'users-data.json'), 'utf8'));
        const idx = users.findIndex((u) => u.discordId === userRecord.discordId);
        if (idx !== -1) {
          users[idx] = { ...users[idx], ...userRecord };
        } else {
          users.push({
            ...userRecord,
            joinDate: new Date().toISOString(),
            profileStats: { photosCount: 0, likesReceived: 0, commentsCount: 0 },
            favoritePhotos: [],
          });
        }
        fs.writeFileSync(path.join(__dirname, 'users-data.json'), JSON.stringify(users, null, 2));
        
        return done(null, { discordId: userRecord.discordId });
      } catch (err) {
        return done(err);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.discordId);
});

passport.deserializeUser((discordId, done) => {
  try {
    const users = JSON.parse(fs.readFileSync(path.join(__dirname, 'users-data.json'), 'utf8'));
    const u = users.find((u) => u.discordId === discordId);
    done(null, u || false);
  } catch (err) {
    done(err);
  }
});

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Auth routes (Discord OAuth)
app.use('/auth', require('./routes/auth')(passport));

// Specific route for serving uploaded images and videos
app.get('/uploads/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', filename);
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// Configure multer for image and video uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Allow images and videos
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit for videos
  }
});

// Data file paths for storing metadata
const PHOTOS_DATA_FILE = path.join(__dirname, 'photos-data.json');
const VIDEOS_DATA_FILE = path.join(__dirname, 'videos-data.json');
const XPOSTS_DATA_FILE = path.join(__dirname, 'xposts-data.json');
const UPLOAD_WHITELIST_FILE = path.join(__dirname, 'upload-whitelist.json');
const MIXTAPES_STATE_FILE = path.join(__dirname, 'mixtapes-state.json');

// Initialize data files if they don't exist
if (!fs.existsSync(PHOTOS_DATA_FILE)) {
  fs.writeFileSync(PHOTOS_DATA_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(VIDEOS_DATA_FILE)) {
  fs.writeFileSync(VIDEOS_DATA_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(XPOSTS_DATA_FILE)) {
  fs.writeFileSync(XPOSTS_DATA_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(UPLOAD_WHITELIST_FILE)) {
  fs.writeFileSync(UPLOAD_WHITELIST_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(MIXTAPES_STATE_FILE)) {
  fs.writeFileSync(MIXTAPES_STATE_FILE, JSON.stringify({
    playlistId: 'RDQMwbpzXXO29_k',
    index: 0,
    videoId: '',
    timeSec: 0,
    paused: false,
    updatedAt: 0
  }, null, 2));
}

// Helper function to read photos data
function readPhotosData() {
  try {
    const data = fs.readFileSync(PHOTOS_DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading photos data:', error);
    return [];
  }
}

// Helper function to write photos data
function writePhotosData(data) {
  try {
    fs.writeFileSync(PHOTOS_DATA_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing photos data:', error);
    return false;
  }
}

// Mixtapes state helpers
function readMixtapesState() {
  try {
    return JSON.parse(fs.readFileSync(MIXTAPES_STATE_FILE, 'utf8'));
  } catch (e) {
    return { playlistId: 'RDQMwbpzXXO29_k', index: 0, videoId: '', timeSec: 0, paused: false, updatedAt: 0 };
  }
}
function writeMixtapesState(state) {
  try {
    fs.writeFileSync(MIXTAPES_STATE_FILE, JSON.stringify(state, null, 2));
    return true;
  } catch (e) {
    return false;
  }
}

// Helper function to read videos data
function readVideosData() {
  try {
    const data = fs.readFileSync(VIDEOS_DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading videos data:', error);
    return [];
  }
}

// Helper function to write videos data
function writeVideosData(data) {
  try {
    fs.writeFileSync(VIDEOS_DATA_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing videos data:', error);
    return false;
  }
}

// Helper function to read X posts data
function readXPostsData() {
  try {
    const data = fs.readFileSync(XPOSTS_DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading X posts data:', error);
    return [];
  }
}

// Helper function to write X posts data
function writeXPostsData(data) {
  try {
    fs.writeFileSync(XPOSTS_DATA_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing X posts data:', error);
    return false;
  }
}

// Helper function to read upload whitelist
function readUploadWhitelist() {
  try {
    const data = fs.readFileSync(UPLOAD_WHITELIST_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading upload whitelist:', error);
    return [];
  }
}

// Helper function to check if user can upload
function canUserUpload(discordId) {
  const whitelist = readUploadWhitelist();
  return whitelist.includes(discordId);
}

// Middleware to check authentication and upload permissions
function requireUploadPermission(req, res, next) {
  // Check if user is authenticated
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Check if user has upload permission
  if (!canUserUpload(req.user.discordId)) {
    return res.status(403).json({ error: 'Upload permission denied. Contact an administrator.' });
  }
  
  next();
}

// Routes
// Persist and retrieve Mixtapes (radio) state so the stream continues between empty sessions
app.get('/api/mixtapes/state', (req, res) => {
  res.json(readMixtapesState());
});

app.post('/api/mixtapes/state', (req, res) => {
  try {
    const { playlistId, videoId, timeSec, paused, updatedAt, index } = req.body || {};
    const current = readMixtapesState();
    const next = {
      playlistId: playlistId || current.playlistId,
      index: Number.isFinite(index) ? Number(index) : (Number.isFinite(current.index) ? current.index : 0),
      videoId: typeof videoId === 'string' ? videoId : current.videoId,
      timeSec: Number.isFinite(timeSec) ? Number(timeSec) : current.timeSec,
      paused: typeof paused === 'boolean' ? paused : current.paused,
      updatedAt: Number.isFinite(updatedAt) ? Number(updatedAt) : Date.now(),
    };
    if (writeMixtapesState(next)) return res.json({ success: true });
    return res.status(500).json({ success: false });
  } catch (e) {
    return res.status(400).json({ success: false, error: 'invalid payload' });
  }
});

// Video Management Endpoints
// GET /api/videos - Get all videos
app.get('/api/videos', (req, res) => {
  try {
    const videos = readVideosData();
    res.json(videos);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

// POST /api/videos - Upload a new video
app.post('/api/videos', requireUploadPermission, upload.single('video'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const { title, description } = req.body;
    const newVideo = {
      id: Date.now().toString(),
      url: `/uploads/${req.file.filename}`,
      title: title || 'Untitled Video',
      description: description || '',
      likes: 0,
      comments: [],
      uploadedAt: new Date().toISOString(),
      uploadedBy: req.user.discordId,
    };

    const videos = readVideosData();
    videos.push(newVideo);
    if (writeVideosData(videos)) {
      res.status(201).json(newVideo);
    } else {
      res.status(500).json({ error: 'Failed to save video data' });
    }
  } catch (error) {
    console.error('Video upload error:', error);
    res.status(500).json({ error: 'Failed to upload video' });
  }
});

// DELETE /api/videos/:id - Delete a video
app.delete('/api/videos/:id', requireUploadPermission, (req, res) => {
  try {
    const { id } = req.params;
    const videos = readVideosData();
    const index = videos.findIndex(v => v.id === id);
    if (index === -1) return res.status(404).json({ error: 'Video not found' });
    if (videos[index].uploadedBy !== req.user.discordId) {
      return res.status(403).json({ error: 'You can only delete your own videos' });
    }

    const videoPath = path.join(__dirname, videos[index].url.replace('/uploads/', 'uploads/'));
    if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
    videos.splice(index, 1);
    if (writeVideosData(videos)) return res.json({ message: 'Video deleted successfully' });
    return res.status(500).json({ error: 'Failed to delete video' });
  } catch (error) {
    console.error('Video deletion error:', error);
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

// GET /api/photos - Get all photos
app.get('/api/photos', (req, res) => {
  try {
    const photos = readPhotosData();
    res.json(photos);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

// POST /api/photos - Upload a new photo or video
app.post('/api/photos', requireUploadPermission, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image or video file provided' });
    }

    const { title, description } = req.body;
    
    const newPhoto = {
      id: Date.now().toString(),
      url: `/uploads/${req.file.filename}`,
      title: title || 'Untitled Photo',
      description: description || '',
      likes: 0,
      comments: [],
      likedByUser: false,
      uploadedAt: new Date().toISOString()
    };

    const photos = readPhotosData();
    photos.push(newPhoto);
    
    if (writePhotosData(photos)) {
      res.status(201).json(newPhoto);
    } else {
      res.status(500).json({ error: 'Failed to save photo data' });
    }
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

// POST /api/photos/:id/like - Toggle like on a photo
app.post('/api/photos/:id/like', (req, res) => {
  try {
    const { id } = req.params;
    const photos = readPhotosData();
    const photoIndex = photos.findIndex(p => p.id === id);
    
    if (photoIndex === -1) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    photos[photoIndex].likes += 1;
    
    if (writePhotosData(photos)) {
      res.json(photos[photoIndex]);
    } else {
      res.status(500).json({ error: 'Failed to update photo' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to like photo' });
  }
});

// POST /api/photos/:id/comments - Add comment to a photo
app.post('/api/photos/:id/comments', (req, res) => {
  try {
    const { id } = req.params;
    const { user, text } = req.body;
    
    if (!user || !text) {
      return res.status(400).json({ error: 'User and text are required' });
    }

    const photos = readPhotosData();
    const photoIndex = photos.findIndex(p => p.id === id);
    
    if (photoIndex === -1) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    const newComment = {
      id: Date.now().toString(),
      user,
      text,
      timestamp: new Date().toISOString()
    };

    photos[photoIndex].comments.push(newComment);
    
    if (writePhotosData(photos)) {
      res.status(201).json(newComment);
    } else {
      res.status(500).json({ error: 'Failed to add comment' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// DELETE /api/photos/:id - Delete a photo
app.delete('/api/photos/:id', (req, res) => {
  try {
    const { id } = req.params;
    const photos = readPhotosData();
    const photoIndex = photos.findIndex(p => p.id === id);
    
    if (photoIndex === -1) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    const photo = photos[photoIndex];
    
    // Delete the file
    const filePath = path.join(__dirname, photo.url);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Remove from data
    photos.splice(photoIndex, 1);
    
    if (writePhotosData(photos)) {
      res.json({ message: 'Photo deleted successfully' });
    } else {
      res.status(500).json({ error: 'Failed to delete photo' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

// X Posts Routes

// GET /api/xposts - Get all X posts
app.get('/api/xposts', (req, res) => {
  try {
    const posts = readXPostsData();
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch X posts' });
  }
});

// POST /api/xposts - Add a new X post
app.post('/api/xposts', requireUploadPermission, (req, res) => {
  try {
    const { author, content, image, url } = req.body;
    
    if (!author || !content || !url) {
      return res.status(400).json({ error: 'Author, content, and URL are required' });
    }

    const newPost = {
      id: Date.now().toString(),
      author: {
        name: author.name || 'Unknown',
        handle: author.handle || '@unknown',
        avatar: author.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=50&h=50&fit=crop',
        verified: author.verified || false
      },
      content,
      image: image || undefined,
      timestamp: new Date().toISOString(),
      engagement: {
        likes: 0,
        comments: 0,
        reposts: 0,
        views: 0
      },
      url,
      liked: false,
      reposted: false
    };

    const posts = readXPostsData();
    posts.unshift(newPost); // Add to beginning
    
    if (writeXPostsData(posts)) {
      res.status(201).json(newPost);
    } else {
      res.status(500).json({ error: 'Failed to save X post' });
    }
  } catch (error) {
    console.error('X post creation error:', error);
    res.status(500).json({ error: 'Failed to create X post' });
  }
});

// PUT /api/xposts/:id/like - Toggle like on an X post
app.put('/api/xposts/:id/like', (req, res) => {
  try {
    const { id } = req.params;
    const posts = readXPostsData();
    const postIndex = posts.findIndex(p => p.id === id);
    
    if (postIndex === -1) {
      return res.status(404).json({ error: 'X post not found' });
    }

    posts[postIndex].liked = !posts[postIndex].liked;
    posts[postIndex].engagement.likes += posts[postIndex].liked ? 1 : -1;
    
    if (writeXPostsData(posts)) {
      res.json(posts[postIndex]);
    } else {
      res.status(500).json({ error: 'Failed to update X post' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to like X post' });
  }
});

// PUT /api/xposts/:id/repost - Toggle repost on an X post
app.put('/api/xposts/:id/repost', (req, res) => {
  try {
    const { id } = req.params;
    const posts = readXPostsData();
    const postIndex = posts.findIndex(p => p.id === id);
    
    if (postIndex === -1) {
      return res.status(404).json({ error: 'X post not found' });
    }

    posts[postIndex].reposted = !posts[postIndex].reposted;
    posts[postIndex].engagement.reposts += posts[postIndex].reposted ? 1 : -1;
    
    if (writeXPostsData(posts)) {
      res.json(posts[postIndex]);
    } else {
      res.status(500).json({ error: 'Failed to update X post' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to repost X post' });
  }
});

// DELETE /api/xposts/:id - Delete an X post
app.delete('/api/xposts/:id', (req, res) => {
  try {
    const { id } = req.params;
    const posts = readXPostsData();
    const postIndex = posts.findIndex(p => p.id === id);
    
    if (postIndex === -1) {
      return res.status(404).json({ error: 'X post not found' });
    }

    posts.splice(postIndex, 1);
    
    if (writeXPostsData(posts)) {
      res.json({ message: 'X post deleted successfully' });
    } else {
      res.status(500).json({ error: 'Failed to delete X post' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete X post' });
  }
});

// POST /api/xposts/extract - Extract post data from X URL using meta tags
app.post('/api/xposts/extract', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate X URL format
    const urlMatch = url.match(/x\.com\/([^\/]+)\/status\/(\d+)/);
    if (!urlMatch) {
      return res.status(400).json({ error: 'Invalid X post URL format' });
    }

    // Try multiple approaches to get post data
    
    // 1. Try X's oEmbed API first
    const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true&hide_thread=true`;
    
    try {
      const oembedResponse = await fetch(oembedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (oembedResponse.ok) {
        const oembedData = await oembedResponse.json();
        console.log('oEmbed data:', oembedData);
        
        if (oembedData.html) {
          // Extract data from oEmbed response
          const htmlContent = oembedData.html;
          
          // Extract text content from HTML (remove HTML tags and decode entities)
          let textContent = htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          // Decode HTML entities
          textContent = textContent.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
          // Remove the signature line (everything after &mdash;)
          textContent = textContent.replace(/&mdash;.*$/, '').trim();
          
          // Extract image from oEmbed HTML - simplified approach
          let image = undefined;
          
          // Look for pic.twitter.com links in the content
          const picMatch = htmlContent.match(/pic\.twitter\.com\/([a-zA-Z0-9]+)/);
          if (picMatch) {
            const imageId = picMatch[1];
            
            // For now, let's use a placeholder image to indicate there's an image
            // This is a temporary solution until we figure out the correct Twitter media URL format
            image = `https://via.placeholder.com/400x300/1DA1F2/FFFFFF?text=Image+from+X+Post`;
            
            console.log('Found image indicator for:', imageId);
            console.log('Using placeholder image:', image);
          }
          
          // Extract author info
          const authorName = oembedData.author_name || username;
          const authorUrl = oembedData.author_url || '';
          const authorHandle = authorUrl ? `@${authorUrl.split('/').pop()}` : `@${username}`;
          
          // Try to get real profile picture
          const profilePicUrl = authorUrl ? `https://pbs.twimg.com/profile_images/default_profile_normal.png` : `https://images.unsplash.com/photo-${Math.random().toString(36).substring(2, 15)}?w=50&h=50&fit=crop`;
          
          return res.json({
            success: true,
            data: {
              author: {
                name: authorName,
                handle: authorHandle,
                avatar: profilePicUrl,
                verified: Math.random() > 0.5
              },
              content: textContent || oembedData.author_name || 'Check out this post on X!',
              image: image,
              url: url
            }
          });
        }
      }
    } catch (oembedError) {
      console.log('oEmbed API failed:', oembedError.message);
    }
    
    // 2. Try using a different oEmbed endpoint
    const altOembedUrl = `https://api.twitter.com/1.1/statuses/oembed.json?url=${encodeURIComponent(url)}&omit_script=true&hide_thread=true`;
    
    try {
      const altResponse = await fetch(altOembedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (altResponse.ok) {
        const altData = await altResponse.json();
        console.log('Alt oEmbed data:', altData);
        
        if (altData.html) {
          const htmlContent = altData.html;
          const textContent = htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          const imgMatch = htmlContent.match(/<img[^>]+src=["']([^"']+)["']/);
          const image = imgMatch ? imgMatch[1] : undefined;
          
          return res.json({
            success: true,
            data: {
              author: {
                name: altData.author_name || username,
                handle: `@${username}`,
                avatar: `https://images.unsplash.com/photo-${Math.random().toString(36).substring(2, 15)}?w=50&h=50&fit=crop`,
                verified: Math.random() > 0.5
              },
              content: textContent || 'Check out this post on X!',
              image: image,
              url: url
            }
          });
        }
      }
    } catch (altError) {
      console.log('Alt oEmbed API failed:', altError.message);
    }

    // Fallback: Fetch the X post page to extract meta tags
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch X post');
    }

    const html = await response.text();
    console.log('HTML length:', html.length);
    console.log('HTML preview:', html.substring(0, 1000));
    
    // Extract meta tags using regex
    const extractMetaTag = (name) => {
      const regex = new RegExp(`<meta\\s+name=["']${name}["']\\s+content=["']([^"']+)["']`, 'i');
      const match = html.match(regex);
      console.log(`Looking for ${name}:`, match ? match[1] : 'not found');
      return match ? match[1] : null;
    };

    const extractPropertyTag = (property) => {
      const regex = new RegExp(`<meta\\s+property=["']${property}["']\\s+content=["']([^"']+)["']`, 'i');
      const match = html.match(regex);
      console.log(`Looking for ${property}:`, match ? match[1] : 'not found');
      return match ? match[1] : null;
    };

    // Extract post data from meta tags (following X Cards documentation)
    const title = extractMetaTag('twitter:title') || extractPropertyTag('og:title');
    const description = extractMetaTag('twitter:description') || extractPropertyTag('og:description');
    const image = extractMetaTag('twitter:image') || extractPropertyTag('og:image');
    const site = extractMetaTag('twitter:site');
    const creator = extractMetaTag('twitter:creator');
    
    // Extract username from URL
    const username = urlMatch[1];
    
    // Generate author data
    const authorHandle = site || creator || `@${username}`;
    const authorName = title ? title.split(' ')[0] : username; // Use first word of title as name
    
              // Try to get profile picture from X's CDN with multiple fallbacks
          let profilePicUrl = `https://pbs.twimg.com/profile_images/default_profile_normal.png`;
          
          // Try to get the actual profile picture if we have the author URL
          if (oembedData.author_url) {
            try {
              const profileResponse = await fetch(oembedData.author_url, { method: 'HEAD' });
              if (profileResponse.ok) {
                // Try to construct profile picture URL
                const username = oembedData.author_url.split('/').pop();
                const possibleProfileUrls = [
                  `https://pbs.twimg.com/profile_images/default_profile_normal.png`,
                  `https://pbs.twimg.com/profile_images/default_profile_400x400_normal.png`,
                  `https://pbs.twimg.com/profile_images/default_profile_200x200_normal.png`
                ];
                
                // Use the first available profile picture
                profilePicUrl = possibleProfileUrls[0];
              }
            } catch (e) {
              console.log('Failed to get profile picture:', e.message);
            }
          }
    
    console.log('Meta tag extraction results:', {
      title,
      description,
      image,
      site,
      creator,
      authorName,
      authorHandle
    });
    
    res.json({
      success: true,
      data: {
        author: {
          name: authorName,
          handle: authorHandle,
          avatar: profilePicUrl,
          verified: Math.random() > 0.5 // Random verification status
        },
        content: description || title || 'Check out this post on X!',
        image: image || undefined,
        url: url
      }
    });
    
  } catch (error) {
    console.error('X post extraction error:', error);
    
    // Fallback to mock data if extraction fails
    const username = url.match(/x\.com\/([^\/]+)\/status\/(\d+)/)?.[1] || 'user';
    const postId = url.match(/x\.com\/([^\/]+)\/status\/(\d+)/)?.[2] || '123';
    
    const mockPosts = [
      {
        author: {
          name: 'Community Event',
          handle: `@${username}`,
          avatar: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=50&h=50&fit=crop',
          verified: true
        },
        content: 'Amazing turnout at our latest meetup! 🎉 The energy was incredible and the discussions were mind-blowing. Can\'t wait for the next one! #Community #Innovation',
        image: 'https://images.unsplash.com/photo-1519389950473-47ba02257781?w=400&h=300&fit=crop'
      },
      {
        author: {
          name: 'Tech Speaker',
          handle: `@${username}`,
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=50&h=50&fit=crop',
          verified: false
        },
        content: 'Just wrapped up an incredible session on the future of web development. The questions from the audience were fantastic! Thanks everyone for the great discussion.',
        image: undefined
      }
    ];
    
    const mockIndex = parseInt(postId) % mockPosts.length;
    const postData = mockPosts[mockIndex];
    
    res.json({
      success: true,
      data: {
        author: postData.author,
        content: postData.content,
        image: postData.image,
        url: url
      }
    });
  }
});

// X oEmbed proxy endpoint
app.post('/api/xposts/oembed', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Use X's oEmbed API with proper headers
    const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true&hide_thread=true&theme=light`;
    
    const response = await fetch(oembedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`X API responded with status: ${response.status}`);
    }

    const data = await response.json();
    
    console.log('X oEmbed response:', data);
    
    res.json({
      success: true,
      data: {
        html: data.html,
        authorName: data.author_name,
        authorUrl: data.author_url,
        width: data.width,
        height: data.height
      }
    });
  } catch (error) {
    console.error('Error fetching X oEmbed:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch X post embed',
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Check upload permissions for current user
app.get('/api/upload-permissions', (req, res) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ canUpload: false, error: 'Not authenticated' });
  }
  
  const canUpload = canUserUpload(req.user.discordId);
  res.json({ 
    canUpload,
    userId: req.user.discordId,
    username: req.user.username
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Retro Recap Backend running on port ${PORT}`);
  console.log(`📸 Photo uploads will be stored in: ${path.join(__dirname, 'uploads')}`);
  console.log(`📊 Photo data stored in: ${PHOTOS_DATA_FILE}`);
}); 