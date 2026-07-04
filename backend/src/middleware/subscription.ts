import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ACTIVE_STATUSES = new Set(['active', 'grace_period']);

// Gate for /api/* routes that need real data access. Chains authentication +
// subscription check. 401 when no user is attached; 402 with a machine-
// readable `subscription_required` code when the user has no active/
// grace-period subscription (or it's expired). Clients route 402 to a paywall.
export async function ensureAuthenticatedWithSubscription(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const userId = (req.user as { id: number }).id;
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { status: true, expiresAt: true },
  });

  if (!sub || !ACTIVE_STATUSES.has(sub.status)) {
    return res.status(402).json({ error: 'subscription_required' });
  }
  if (sub.expiresAt && sub.expiresAt < new Date()) {
    return res.status(402).json({ error: 'subscription_required' });
  }

  return next();
}
