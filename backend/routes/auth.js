const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Environment configuration
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || 'your_discord_client_id';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || 'your_discord_client_secret';
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'http://localhost:3001/auth/discord/callback';
const SESSION_SECRET = process.env.SESSION_SECRET || 'change_this_session_secret_in_production';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

// Per-route CORS with credentials for auth endpoints
router.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));

// Session middleware scoped to auth routes
router.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // set true behind HTTPS/proxy with trust proxy
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

router.use(passport.initialize());
router.use(passport.session());

// Users data storage (JSON file)
const USERS_DATA_FILE = path.join(__dirname, '..', 'users-data.json');
if (!fs.existsSync(USERS_DATA_FILE)) {
  fs.writeFileSync(USERS_DATA_FILE, JSON.stringify([], null, 2));
}

function readUsers() {
  try {
    const raw = fs.readFileSync(USERS_DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(USERS_DATA_FILE, JSON.stringify(users, null, 2));
}

function getUser(discordId) {
  return readUsers().find((u) => u.discordId === discordId) || null;
}

function saveUser(userData) {
  const users = readUsers();
  const idx = users.findIndex((u) => u.discordId === userData.discordId);
  if (idx !== -1) {
    users[idx] = { ...users[idx], ...userData };
  } else {
    users.push({
      ...userData,
      joinDate: new Date().toISOString(),
      profileStats: { photosCount: 0, likesReceived: 0, commentsCount: 0 },
      favoritePhotos: [],
    });
  }
  writeUsers(users);
}

function toPublicUser(u) {
  if (!u) return null;
  const avatarUrl = u.avatar
    ? `https://cdn.discordapp.com/avatars/${u.discordId}/${u.avatar}.png`
    : null;
  return {
    discordId: u.discordId,
    username: u.username,
    discriminator: u.discriminator,
    avatar: avatarUrl,
    email: u.email || null,
    joinDate: u.joinDate,
    profileStats: u.profileStats || { photosCount: 0, likesReceived: 0, commentsCount: 0 },
    favoritePhotos: u.favoritePhotos || [],
  };
}

// Passport Discord strategy
passport.use(
  new DiscordStrategy(
    {
      clientID: DISCORD_CLIENT_ID,
      clientSecret: DISCORD_CLIENT_SECRET,
      callbackURL: DISCORD_REDIRECT_URI,
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
        saveUser(userRecord);
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
    const u = getUser(discordId);
    done(null, u || false);
  } catch (err) {
    done(err);
  }
});

// Routes
router.get('/discord', passport.authenticate('discord'));

router.get(
  '/discord/callback',
  passport.authenticate('discord', { failureRedirect: `${FRONTEND_ORIGIN}/login?error=oauth_failed` }),
  (req, res) => {
    res.redirect(`${FRONTEND_ORIGIN}/?auth=success`);
  }
);

router.get('/user', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.json({ user: toPublicUser(req.user) });
  }
  return res.status(401).json({ error: 'Not authenticated' });
});

router.post('/logout', (req, res, next) => {
  req.logout(function (err) {
    if (err) return next(err);
    res.json({ message: 'Logged out' });
  });
});

module.exports = router;

