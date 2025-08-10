const express = require('express');
const cors = require('cors');

module.exports = function(passport) {
  const router = express.Router();

// Environment configuration
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:8080';

// Per-route CORS with credentials for auth endpoints
router.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));

// User data storage is now handled in the main server









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

// Passport strategy is now defined in the main server

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

  return router;
};

