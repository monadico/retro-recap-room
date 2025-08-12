const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { SiweMessage, generateNonce } = require('siwe');

module.exports = function(passport) {
  const router = express.Router();

// Environment configuration helper (evaluated at call time to avoid stale values)
const getFrontendOrigin = () => process.env.FRONTEND_ORIGIN || 'http://localhost:8080';
console.log('[auth] FRONTEND_ORIGIN (initial) =', getFrontendOrigin());
const allowedOrigins = [getFrontendOrigin(), 'http://localhost:8080', 'http://127.0.0.1:8080'];

// Per-route CORS with credentials for auth endpoints
router.use((req, res, next) => {
  const requestOrigin = req.headers.origin;
  const originToUse = allowedOrigins.includes(requestOrigin) ? requestOrigin : getFrontendOrigin();
  // set CORS headers explicitly to ensure correct origin
  res.header('Access-Control-Allow-Origin', originToUse);
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  return next();
});

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
    walletAddress: u.walletAddress || null,
  };
}

// Routes
router.get('/discord', passport.authenticate('discord'));

router.get(
  '/discord/callback',
  (req, res, next) => {
    // Build failure redirect dynamically to avoid stale env values
    const failureRedirect = `${getFrontendOrigin()}/login?error=oauth_failed`;
    return passport.authenticate('discord', { failureRedirect })(req, res, next);
  },
  (req, res) => {
    const redirectUrl = `${getFrontendOrigin()}/?auth=success`;
    console.log('[auth] Successful OAuth. Redirecting to:', redirectUrl);
    res.redirect(redirectUrl);
  }
);

router.get('/user', (req, res) => {
  const cookieHeader = req.headers.cookie || '(no cookie)';
  console.log('[auth] /auth/user request', {
    origin: req.headers.origin,
    hasSession: !!req.session,
    sessionID: req.sessionID,
    isAuthenticated: typeof req.isAuthenticated === 'function' ? req.isAuthenticated() : false,
    hasUser: !!req.user,
    cookieHeader,
  });
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.json(toPublicUser(req.user));
  }
  return res.status(401).json({ error: 'Not authenticated' });
});

router.post('/logout', (req, res, next) => {
  req.logout(function (err) {
    if (err) return next(err);
    res.json({ message: 'Logged out' });
  });
});

// SIWE endpoints
router.get('/siwe/nonce', (req, res) => {
  try {
    const nonce = generateNonce();
    req.session.siweNonce = nonce;
    res.json({ nonce });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create nonce' });
  }
});

router.post('/siwe/verify', express.json(), async (req, res) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { message, signature } = req.body || {};
    if (!message || !signature) {
      return res.status(400).json({ error: 'Missing message or signature' });
    }

    const siweMessage = new SiweMessage(message);
    const { data: fields } = await siweMessage.verify({
      signature,
      nonce: req.session.siweNonce,
    });

    // Link wallet to the Discord user
    const usersPath = path.join(__dirname, '..', 'users-data.json');
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    const idx = users.findIndex((u) => u.discordId === req.user.discordId);
    if (idx === -1) return res.status(404).json({ error: 'User not found' });

    users[idx].walletAddress = fields.address;
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

    // Also update req.user for this session
    req.user.walletAddress = fields.address;

    return res.json({ success: true, walletAddress: fields.address });
  } catch (e) {
    console.error('SIWE verify error:', e);
    return res.status(400).json({ error: 'Invalid SIWE message' });
  }
});

router.get('/siwe/status', (req, res) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const walletAddress = req.user?.walletAddress || null;
  res.json({ walletAddress });
});

  return router;
};

