import express from 'express';
import passport from 'passport';
import { PrismaClient } from '@prisma/client';
import { verifyGoogleIdToken } from '../services/googleVerify';
import { signMobileToken } from '../services/jwtService';

const router = express.Router();
const prisma = new PrismaClient();

function getAllowedEmails(): Set<string> {
  const raw = process.env.ALLOWED_EMAILS;
  if (!raw) {
    throw new Error('ALLOWED_EMAILS must be set');
  }
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0)
  );
}

// Start Google OAuth flow
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  })
);

// Google OAuth callback
router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=auth_failed`,
  }),
  (req, res) => {
    // Successful authentication, redirect to frontend
    res.redirect(process.env.FRONTEND_URL || 'http://localhost:3000');
  }
);

// Mobile sign-in: exchange a Google ID token (obtained by the Android client
// via Credential Manager) for a long-lived bearer token usable on /api/*.
router.post('/google/mobile', async (req, res) => {
  const { idToken } = req.body ?? {};
  if (typeof idToken !== 'string' || idToken.length === 0) {
    return res.status(400).json({ error: 'idToken is required' });
  }

  let identity;
  try {
    identity = await verifyGoogleIdToken(idToken);
  } catch {
    return res.status(401).json({ error: 'Invalid Google ID token' });
  }

  const allowedEmails = getAllowedEmails();
  if (!allowedEmails.has(identity.email.toLowerCase())) {
    return res.status(403).json({ error: 'Unauthorized email address' });
  }

  const user = await prisma.user.upsert({
    where: { googleId: identity.sub },
    update: { email: identity.email, name: identity.name },
    create: {
      googleId: identity.sub,
      email: identity.email,
      name: identity.name,
    },
    select: { id: true, email: true, name: true },
  });

  const token = signMobileToken(user.id);
  return res.json({ token, user });
});

// Logout
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

// Get current user
router.get('/me', (req, res) => {
  if (req.isAuthenticated()) {
    res.json(req.user);
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

export default router;
