import express from 'express';
import { PrismaClient } from '@prisma/client';
import { ensureAuthenticated } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/me — whoami. Deliberately not subscription-gated so clients can
// distinguish "not signed in" (401) from "signed in but blocked by paywall".
router.get('/', ensureAuthenticated, (req, res) => {
  res.json(req.user);
});

// GET /api/me/subscription — subscription state for the current user. Used by
// clients to decide between content and paywall. Not subscription-gated (that
// would be circular).
router.get('/subscription', ensureAuthenticated, async (req, res) => {
  const userId = (req.user as { id: number }).id;
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: {
      status: true,
      source: true,
      expiresAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!sub) {
    return res.json({ subscription: null });
  }

  return res.json({ subscription: sub });
});

export default router;
