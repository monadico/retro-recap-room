require("dotenv").config({ override: true });
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const session = require('express-session');
const FileStoreFactory = require('session-file-store');
const passport = require('passport');
const WebSocket = require('ws');

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

// Data directory (mount this as a volume in production)
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Serve uploads from data directory
app.use(express.static(UPLOADS_DIR));

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
      callbackURL: process.env.DISCORD_REDIRECT_URI,
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
  const filePath = path.join(UPLOADS_DIR, filename);
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// Configure multer for image and video uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR)
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
const PHOTOS_DATA_FILE = path.join(DATA_DIR, 'photos-data.json');
const VIDEOS_DATA_FILE = path.join(DATA_DIR, 'videos-data.json');
const XPOSTS_DATA_FILE = path.join(DATA_DIR, 'xposts-data.json');
const UPLOAD_WHITELIST_FILE = path.join(DATA_DIR, 'upload-whitelist.json');
const MIXTAPES_STATE_FILE = path.join(DATA_DIR, 'mixtapes-state.json');
const CHAT_DATA_FILE = path.join(DATA_DIR, 'chat-data.json');
const CANVA_STATE_FILE = path.join(DATA_DIR, 'canva-state.json');
const CANVA_CONTRACT_ADDRESS_FILE = path.join(DATA_DIR, 'canva-contract-address.txt');
const CANVA_TESTER_IDS = String(process.env.CANVA_TESTER_IDS || '348265632770424832')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
// Old achievements/NFT files removed

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
if (!fs.existsSync(CHAT_DATA_FILE)) {
  fs.writeFileSync(CHAT_DATA_FILE, JSON.stringify({
    messages: [],
    users: []
  }, null, 2));
}
if (!fs.existsSync(CANVA_STATE_FILE)) {
  fs.writeFileSync(CANVA_STATE_FILE, JSON.stringify({
    width: 20,
    height: 12,
    placements: [],
    nextTokenId: 1
  }, null, 2));
}
// Removed achievements minted file init

// Helper to read users data
function readUsersData() {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'users-data.json'), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading users data:', error);
    return [];
  }
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

// Chat data helpers
function readChatData() {
  try {
    const data = fs.readFileSync(CHAT_DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading chat data:', error);
    return { messages: [], users: [] };
  }
}

function writeChatData(data) {
  try {
    fs.writeFileSync(CHAT_DATA_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing chat data:', error);
    return false;
  }
}

// Canva state helpers
function readCanvaState() {
  try {
    const data = fs.readFileSync(CANVA_STATE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return { width: 20, height: 12, placements: [], nextTokenId: 1 };
  }
}
function writeCanvaState(state) {
  try {
    fs.writeFileSync(CANVA_STATE_FILE, JSON.stringify(state, null, 2));
    return true;
  } catch (e) {
    return false;
  }
}

function isCanvaTester(req) {
  try {
    const id = req?.user?.discordId;
    return !!id && CANVA_TESTER_IDS.includes(String(id));
  } catch (_) {
    return false;
  }
}

// Removed achievements persistence and bypass wallet helpers

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

// Return current contract address used for minting
app.get('/api/canva/contract-address', (_req, res) => {
  try {
    const fromEnv = process.env.CANVA_CONTRACT_ADDRESS;
    const fromFile = fs.existsSync(CANVA_CONTRACT_ADDRESS_FILE)
      ? fs.readFileSync(CANVA_CONTRACT_ADDRESS_FILE, 'utf8').trim()
      : null;
    const addr = fromEnv || fromFile || null;
    if (!addr) return res.status(404).json({ error: 'Contract address not configured' });
    res.json({ address: addr });
  } catch (e) {
    res.status(500).json({ error: 'Failed to read contract address' });
  }
});

// Allocate a tokenId for minting and return contract address
app.post('/api/canva/mint-params', (req, res) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const fromEnv = process.env.CANVA_CONTRACT_ADDRESS;
    const fromFile = fs.existsSync(CANVA_CONTRACT_ADDRESS_FILE)
      ? fs.readFileSync(CANVA_CONTRACT_ADDRESS_FILE, 'utf8').trim()
      : null;
    const address = fromEnv || fromFile || null;
    if (!address) return res.status(500).json({ error: 'Contract address not configured' });

    const state = readCanvaState();
    const tokenId = Number.isInteger(state.nextTokenId) ? state.nextTokenId : 1;
    state.nextTokenId = tokenId + 1;
    if (!writeCanvaState(state)) return res.status(500).json({ error: 'Failed to allocate token id' });
    res.json({ address, tokenId });
  } catch (e) {
    res.status(500).json({ error: 'Failed to build mint params' });
  }
});

// Canva API
// Get current canva state
app.get('/api/canva/state', (req, res) => {
  try {
    const state = readCanvaState();
    res.json(state);
  } catch (e) {
    res.status(500).json({ error: 'Failed to read canva state' });
  }
});

// Place the current user's PFP onto the canva at x,y with optional message
app.post('/api/canva/place', (req, res) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const { x, y, message } = req.body || {};
    const state = readCanvaState();
    const xi = Number(x), yi = Number(y);
    if (!Number.isInteger(xi) || !Number.isInteger(yi)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }
    if (xi < 0 || yi < 0 || xi >= state.width || yi >= state.height) {
      return res.status(400).json({ error: 'Out of bounds' });
    }
    const msg = typeof message === 'string' ? message.trim().slice(0, 140) : '';
    const already = state.placements.find(p => p.x === xi && p.y === yi);

    const userId = req.user.discordId;
    const tester = isCanvaTester(req);
    const userExistingIndex = state.placements.findIndex(p => p.discordId === userId);
    if (userExistingIndex !== -1 && !tester) {
      return res.status(400).json({ error: 'You already have a placement' });
    }
    if (already) return res.status(400).json({ error: 'Slot already taken' });

    // Build Discord avatar URL if available
    const avatarHash = req.user.avatar;
    const avatarUrl = (avatarHash && req.user.discordId)
      ? `https://cdn.discordapp.com/avatars/${req.user.discordId}/${avatarHash}.png`
      : null;
    const username = req.user.username;
    if (tester && userExistingIndex !== -1) {
      state.placements[userExistingIndex] = {
        ...state.placements[userExistingIndex],
        x: xi,
        y: yi,
        username,
        avatarUrl,
        message: msg,
        placedAt: new Date().toISOString(),
      };
    } else {
      state.placements.push({
        x: xi,
        y: yi,
        discordId: userId,
        username,
        avatarUrl,
        message: msg,
        placedAt: new Date().toISOString(),
      });
    }
    if (!writeCanvaState(state)) return res.status(500).json({ error: 'Failed to save placement' });
    res.json({ ok: true, state });
  } catch (e) {
    res.status(500).json({ error: 'Failed to place on canva' });
  }
});

// Validate if current user can place at x,y (no mutation)
app.post('/api/canva/can-place', (req, res) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const { x, y } = req.body || {};
    const state = readCanvaState();
    const xi = Number(x), yi = Number(y);
    if (!Number.isInteger(xi) || !Number.isInteger(yi)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }
    if (xi < 0 || yi < 0 || xi >= state.width || yi >= state.height) {
      return res.status(400).json({ error: 'Out of bounds' });
    }
    const already = state.placements.find(p => p.x === xi && p.y === yi);
    if (already) return res.status(400).json({ error: 'Slot already taken' });
    const userExisting = state.placements.find(p => p.discordId === req.user.discordId);
    if (userExisting) return res.status(400).json({ error: 'You already have a placement' });
    return res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to validate placement' });
  }
});

// Return dynamic metadata for the shared NFT
app.get('/api/canva/metadata', (req, res) => {
  try {
    const state = readCanvaState();
    const host = `${req.protocol}://${req.get('host')}`;
    const image = `${host}/api/canva/image.svg`;
    const name = 'The Canva';
    const description = 'A dynamic community canvas of Discord PFPs.';
    const attributes = [
      { trait_type: 'width', value: state.width },
      { trait_type: 'height', value: state.height },
      { trait_type: 'placements', value: state.placements.length },
    ];
    res.json({ name, description, image, attributes });
  } catch (e) {
    res.status(500).json({ error: 'Failed to build metadata' });
  }
});

// Simple SVG image composer for the canva
app.get('/api/canva/image.svg', (req, res) => {
  try {
    const state = readCanvaState();
    const cell = 32; // px per cell
    const padding = 8;
    const w = padding * 2 + state.width * cell;
    const h = padding * 2 + state.height * cell;
    const rects = [];
    // background grid
    for (let yy = 0; yy < state.height; yy++) {
      for (let xx = 0; xx < state.width; xx++) {
        const x = padding + xx * cell;
        const y = padding + yy * cell;
        rects.push(`<rect x="${x}" y="${y}" width="${cell - 1}" height="${cell - 1}" fill="#0f172a" stroke="#1f2a44" stroke-width="1"/>`);
      }
    }
    // placements: render user avatar images; fallback to colored blocks with initials
    const placements = [];
    for (const p of state.placements) {
      const x = padding + p.x * cell;
      const y = padding + p.y * cell;
      const color = `hsl(${Math.abs(hashCode(p.discordId)) % 360} 70% 45%)`;
      const initials = (p.username || 'U').slice(0, 2).toUpperCase();
      const title = p.message ? `${p.username}: ${p.message}` : p.username;
      if (p.avatarUrl) {
        placements.push(
          `<g>
  <title>${escapeXml(title || '')}</title>
  <rect x="${x}" y="${y}" rx="4" ry="4" width="${cell - 2}" height="${cell - 2}" fill="#0b1020"/>
  <image href="${escapeXml(p.avatarUrl)}" x="${x}" y="${y}" width="${cell - 2}" height="${cell - 2}" preserveAspectRatio="xMidYMid slice"/>
</g>`
        );
      } else {
        placements.push(
          `<g>
  <title>${escapeXml(title || '')}</title>
  <rect x="${x}" y="${y}" rx="4" ry="4" width="${cell - 2}" height="${cell - 2}" fill="${color}"/>
  <text x="${x + cell / 2}" y="${y + cell / 2 + 4}" text-anchor="middle" fill="#ffffff" font-size="12" font-family="monospace">${escapeXml(initials)}</text>
</g>`
        );
      }
    }
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect x="0" y="0" width="100%" height="100%" fill="#0b1020"/>
  ${rects.join('\n  ')}
  ${placements.join('\n  ')}
</svg>`;
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.send(svg);
  } catch (e) {
    return res.status(500).type('text/plain').send('error');
  }
});

function hashCode(s) {
  try {
    let h = 0;
    for (let i = 0; i < String(s).length; i++) {
      h = ((h << 5) - h) + String(s).charCodeAt(i);
      h |= 0;
    }
    return h;
  } catch (_) {
    return 0;
  }
}
function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

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
    uploadedAt: new Date().toISOString(),
    uploadedBy: req.user?.discordId || null
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

// Achievements removed
/* const ACHIEVEMENTS = [
  {
    id: 'first-login',
    name: 'First Login',
    description: 'Logged in with Discord for the first time.',
    check: (ctx) => ctx.user != null,
  },
  {
    id: 'first-chat',
    name: 'First Message',
    description: 'Sent your first chat message.',
    check: (ctx) => ctx.chatMessagesCount > 0,
  },
  {
    id: 'chatter-10',
    name: 'Chatter (50)',
    description: 'Sent 50 chat messages.',
    check: (ctx) => ctx.chatMessagesCount >= 50,
  },
  {
    id: 'uploader',
    name: 'First Upload',
    description: 'Uploaded your first photo or video.',
    check: (ctx) => ctx.uploadsCount > 0,
  },
  {
    id: 'gallery-contributor-5',
    name: 'Gallery Contributor (5)',
    description: 'Uploaded 5 photos or videos.',
    check: (ctx) => ctx.uploadsCount >= 5,
  },
]; */

/* function buildUserActivityContext(discordId) {
  const photos = readPhotosData();
  const videos = readVideosData();
  const chat = readChatData();
  const uploadsCount = photos.filter(p => p.uploadedBy === discordId).length +
    videos.filter(v => v.uploadedBy === discordId).length;
  const chatMessagesCount = chat.messages.filter(m => m.userId === discordId).length;
  const users = readUsersData();
  const user = users.find(u => u.discordId === discordId) || null;
  return { uploadsCount, chatMessagesCount, user };
} */

// Public endpoint: achievements for current user
/* app.get('/api/achievements', (req, res) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const discordId = req.user.discordId;
    const ctx = buildUserActivityContext(discordId);
    const items = ACHIEVEMENTS.map(a => ({
      id: a.id,
      name: a.name,
      description: a.description,
      earned: Boolean(a.check(ctx)),
    }));
    // overlay minted status
    const minted = readMintedAchievements().filter(r => r.discordId === discordId);
    let itemsWithMint = items.map(it => ({
      ...it,
      minted: minted.some(m => m.achievementId === it.id),
      mintedTx: minted.find(m => m.achievementId === it.id)?.txHash || null,
    }));
    const bypassActive = isBypassWallet(req);
    if (bypassActive) {
      itemsWithMint = itemsWithMint.map(it => ({ ...it, earned: true }));
    }
    res.json({ achievements: itemsWithMint, bypassActive });
  } catch (e) {
    res.status(500).json({ error: 'Failed to compute achievements' });
  }
}); */

// Helper endpoint: build badge metadata for an achievement (for use as tokenURI)
/* app.get('/api/achievements/:id/metadata', (req, res) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const id = req.params.id;
    const def = ACHIEVEMENTS.find(a => a.id === id);
    if (!def) return res.status(404).json({ error: 'Achievement not found' });
    const user = req.user;
    const name = `${def.name} — ${user.username}`;
    const description = def.description;
    const image = `${req.protocol}://${req.get('host')}/api/achievements/${encodeURIComponent(id)}/image.svg`;
    const attributes = [
      { trait_type: 'achievement_id', value: def.id },
      { trait_type: 'user', value: user.username },
      { trait_type: 'discord_id', value: user.discordId },
    ];
    res.json({ name, description, image, attributes });
  } catch (e) {
    res.status(500).json({ error: 'Failed to build metadata' });
  }
}); */

// ASCII art SVG generator for achievements
/* function buildAsciiArtLines(achievementKey, username) {
  const uname = (username || 'User').toUpperCase();
  switch (achievementKey) {
    case 'first-login':
      return [
        '+----------------------------------+',
        '|     THE CAPSULE HONOR BADGES     |',
        '|                                  |',
        '|           FIRST LOGIN            |',
        '|                                  |',
        `|   WELCOME, ${uname.padEnd(Math.max(0, 24 - uname.length), ' ')}|`,
        '|               [*]                |',
        '|                                  |',
        '+----------------------------------+',
      ];
    case 'first-chat':
      return [
        '+----------------------------------+',
        '|        COMMUNITY CHITCHAT        |',
        '|                                  |',
        '|          FIRST MESSAGE           |',
        '|                                  |',
        '|        \\   Hello world!        |',
        '|         \\  (…and many more)     |',
        '|          \\                      |',
        '+----------------------------------+',
      ];
    case 'chatter-10':
      return [
        '+----------------------------------+',
        '|           CHATTER (10)           |',
        '|                                  |',
        '|   >>>>>>>>>>>>>>>>>>>>>>>>>>>>   |',
        '|   10 MESSAGES AND COUNTING!      |',
        '|   <<<<<<<<<<<<<<<<<<<<<<<<<<     |',
        '|                                  |',
        '|            KEEP TALKING          |',
        '+----------------------------------+',
      ];
    case 'uploader':
      return [
        '+----------------------------------+',
        '|           FIRST UPLOAD           |',
        '|                                  |',
        '|            [  ^  ]               |',
        '|            [ / \\ ]              |',
        '|            [/__\\]              |',
        '|         YOUR MARK IS MADE        |',
        '|                                  |',
        '+----------------------------------+',
      ];
    case 'gallery-contributor-5':
      return [
        '+----------------------------------+',
        '|      GALLERY CONTRIBUTOR (5)     |',
        '|                                  |',
        '|      [  ____  ]  [  ____  ]      |',
        '|      [ | __ | ]  [ | __ | ]      |',
        '|      [_|/__\|_]  [_|/__\|_]      |',
        '|         FIVE FRAMES UP!          |',
        '|                                  |',
        '+----------------------------------+',
      ];
    default:
      return [
        '+--------------------------+',
        '|      ACHIEVEMENT         |',
        '|         UNKNOWN          |',
        '+--------------------------+',
      ];
  }
} */

/* app.get('/api/achievements/:id/image.svg', (req, res) => {
  try {
    const id = req.params.id;
    const def = ACHIEVEMENTS.find(a => a.id === id);
    if (!def) return res.status(404).type('text/plain').send('Not found');
    const username = req.user?.username || 'User';
    const lines = buildAsciiArtLines(id, username);
    const width = 512;
    const height = 512;
    const fontSize = 16;
    const lineHeight = 20;
    const startY = 120;
    const startX = 64;
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b1020"/>
      <stop offset="100%" stop-color="#1e2a4a"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="100%" height="100%" fill="url(#bg)"/>
  <g font-family="'Courier New', monospace" font-size="${fontSize}" fill="#cde3ff">
    ${lines.map((line, i) => `<text x="${startX}" y="${startY + i * lineHeight}">${line.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`).join('\n    ')}
  </g>
  <text x="16" y="32" fill="#8fb3ff" font-family="'Courier New', monospace" font-size="18">${def.name}</text>
  <text x="16" y="56" fill="#6fa3ff" font-family="'Courier New', monospace" font-size="12">the capsule honor badges</text>
</svg>`;
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.send(svg);
  } catch (e) {
    return res.status(500).type('text/plain').send('error');
  }
}); */

// Issue an EIP-712 permit for minting an earned achievement
/* app.post('/api/achievements/:id/permit', express.json(), async (req, res) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const id = req.params.id;
    const def = ACHIEVEMENTS.find(a => a.id === id);
    if (!def) return res.status(404).json({ error: 'Achievement not found' });

    const discordId = req.user.discordId;
    const ctx = buildUserActivityContext(discordId);
    if (!def.check(ctx) && !isBypassWallet(req)) {
      return res.status(400).json({
        error: 'Achievement not earned',
        debug: {
          achievement: id,
          uploadsCount: ctx.uploadsCount,
          chatMessagesCount: ctx.chatMessagesCount,
        }
      });
    }

    // Load signer from env
    let pk = process.env.ACHIEVEMENTS_SIGNER_PRIVATE_KEY;
    if (!pk && fs.existsSync(SIGNER_KEY_FILE)) {
      pk = fs.readFileSync(SIGNER_KEY_FILE, 'utf8').trim();
    }
    if (!pk) return res.status(500).json({ error: 'Server signer not configured' });

    // Determine contract address
    const contractAddress = process.env.ACHIEVEMENTS_CONTRACT_ADDRESS || (fs.existsSync(CONTRACT_ADDRESS_FILE) ? fs.readFileSync(CONTRACT_ADDRESS_FILE, 'utf8').trim() : null);
    if (!contractAddress) return res.status(500).json({ error: 'Contract address not configured' });

    const to = req.user.walletAddress;
    if (!to) return res.status(400).json({ error: 'Wallet not linked' });

    const deadline = Math.floor(Date.now() / 1000) + 10 * 60; // 10 minutes
    // Use a simple per-request random nonce to avoid replay; contract tracks nonces by address
    const nonceHex = Ethers.hexlify(Ethers.randomBytes(32));

    const signer = new Ethers.Wallet(pk);
    const chainId = 10143; // Monad Testnet
    const domain = {
      name: 'the capsule honor badges',
      version: '1',
      chainId,
      verifyingContract: contractAddress,
    };
    const types = {
      MintPermit: [
        { name: 'to', type: 'address' },
        { name: 'id', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    };
    const value = { to, id: achievementIdFromKey(id), deadline, nonce: nonceHex };
    const signature = await signer.signTypedData(domain, types, value);

    return res.json({
      to,
      id: achievementIdFromKey(id),
      deadline,
      nonce: nonceHex,
      signature,
      contractAddress,
    });
  } catch (e) {
    console.error('permit error', e);
    return res.status(500).json({ error: 'Failed to issue permit' });
  }
}); */

// Map backend achievement key to on-chain numeric id
/* function achievementIdFromKey(key) {
  switch (key) {
    case 'first-login': return 1;
    case 'first-chat': return 2;
    case 'chatter-10': return 3;
    case 'uploader': return 4;
    case 'gallery-contributor-5': return 5;
    default: return 0;
  }
} */

// Record a minted achievement for the current user, preventing duplicates
/* app.post('/api/achievements/:id/minted', (req, res) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const id = req.params.id;
    const def = ACHIEVEMENTS.find(a => a.id === id);
    if (!def) return res.status(404).json({ error: 'Achievement not found' });
    const discordId = req.user.discordId;
    const ctx = buildUserActivityContext(discordId);
    if (!def.check(ctx) && !isBypassWallet(req)) return res.status(400).json({ error: 'Achievement not earned' });

    const { txHash } = req.body || {};
    if (!txHash || typeof txHash !== 'string') return res.status(400).json({ error: 'Missing txHash' });

    const records = readMintedAchievements();
    const already = records.find(r => r.discordId === discordId && r.achievementId === id);
    if (already) return res.status(200).json({ ok: true, already: true });

    records.push({
      discordId,
      achievementId: id,
      txHash,
      mintedAt: new Date().toISOString(),
    });
    if (!writeMintedAchievements(records)) return res.status(500).json({ error: 'Failed to save' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to record minted achievement' });
  }
}); */

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
    const { text } = req.body;
    
    // Check if user is authenticated
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    // Use authenticated user's Discord username
    const user = req.user.username;

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

// Save X post with submitter identity and embed HTML
app.post('/api/xposts/save', (req, res) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const { url, embedHtml } = req.body || {};
    if (!url || !embedHtml) return res.status(400).json({ error: 'url and embedHtml required' });

    const avatarHash = req.user.avatar;
    const avatarUrl = (avatarHash && req.user.discordId)
      ? `https://cdn.discordapp.com/avatars/${req.user.discordId}/${avatarHash}.png`
      : null;
    const post = {
      id: Date.now().toString(),
      url,
      embedHtml,
      authorName: undefined,
      authorUrl: undefined,
      timestamp: new Date().toISOString(),
      submittedBy: {
        discordId: req.user.discordId,
        username: req.user.username,
        avatar: avatarUrl,
      },
    };
    const posts = readXPostsData();
    posts.unshift(post);
    if (!writeXPostsData(posts)) return res.status(500).json({ error: 'Failed to save X post' });
    res.status(201).json(post);
  } catch (e) {
    res.status(500).json({ error: 'Failed to save X post' });
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

const server = app.listen(PORT, () => {
  console.log(`🚀 Retro Recap Backend running on port ${PORT}`);
  console.log(`📸 Photo uploads will be stored in: ${path.join(__dirname, 'uploads')}`);
  console.log(`📊 Photo data stored in: ${PHOTOS_DATA_FILE}`);
});

// WebSocket server for real-time chat
const wss = new WebSocket.Server({ server });

// Store connected clients
const connectedClients = new Map();

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  console.log('🔌 New WebSocket connection');
  
  // Store client info
  const clientId = Date.now().toString();
  connectedClients.set(clientId, {
    ws,
    userId: null,
    username: null,
    avatar: null
  });

  // Send initial chat data
  const chatData = readChatData();
  ws.send(JSON.stringify({
    type: 'chat_data',
    messages: chatData.messages.slice(-50), // Last 50 messages
    users: chatData.users
  }));

  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'user_join':
          // Update client info
          const client = connectedClients.get(clientId);
          if (client) {
            client.userId = message.userId;
            client.username = message.username;
            client.avatar = message.avatar;
          }
          
          // Add user to chat data
          const chatData = readChatData();
          if (!chatData.users.find(u => u.userId === message.userId)) {
            chatData.users.push({
              userId: message.userId,
              username: message.username,
              avatar: message.avatar,
              joinedAt: new Date().toISOString()
            });
            writeChatData(chatData);
          }
          
          // Broadcast user joined
          broadcastToAll({
            type: 'user_joined',
            userId: message.userId,
            username: message.username,
            avatar: message.avatar
          });
          break;

        case 'chat_message':
          // Add message to chat data
          const newMessage = {
            id: Date.now().toString(),
            userId: message.userId,
            username: message.username,
            avatar: message.avatar,
            message: message.message,
            timestamp: Date.now()
          };
          
          const currentChatData = readChatData();
          currentChatData.messages.push(newMessage);
          
          // Keep only last 100 messages
          if (currentChatData.messages.length > 100) {
            currentChatData.messages = currentChatData.messages.slice(-100);
          }
          
          writeChatData(currentChatData);
          
          // Broadcast message to all clients
          broadcastToAll({
            type: 'new_message',
            message: newMessage
          });
          break;

        case 'typing_start':
        case 'typing_stop':
          // Broadcast typing indicators
          broadcastToAll({
            type: message.type,
            userId: message.userId,
            username: message.username
          });
          break;
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  });

  // Handle client disconnect
  ws.on('close', () => {
    console.log('🔌 WebSocket connection closed');
    connectedClients.delete(clientId);
    
    // Broadcast user left
    const client = connectedClients.get(clientId);
    if (client && client.userId) {
      broadcastToAll({
        type: 'user_left',
        userId: client.userId,
        username: client.username
      });
    }
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    connectedClients.delete(clientId);
  });
});

// Helper function to broadcast to all connected clients
function broadcastToAll(data) {
  const message = JSON.stringify(data);
  connectedClients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  });
}

console.log('💬 WebSocket chat server initialized'); 