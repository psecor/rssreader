import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyMobileToken } from '../services/jwtService';

const prisma = new PrismaClient();

/**
 * Accepts `Authorization: Bearer <jwt>` and populates `req.user` from the DB
 * when valid. No-ops (without erroring) when the header is absent, so this
 * composes cleanly with the existing session-based auth — the downstream
 * `ensureAuthenticated` check (which is just `!!req.user`) accepts whichever
 * mechanism filled `req.user` in.
 *
 * Invalid or expired tokens are silently ignored here; downstream auth gates
 * will return 401 themselves when no user ends up attached.
 */
export async function bearerAuth(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next();
  }
  if (req.user) {
    // A session already authenticated this request; bearer is redundant.
    return next();
  }

  const token = header.slice('Bearer '.length).trim();
  try {
    const { userId } = verifyMobileToken(token);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, googleId: true, email: true, name: true },
    });
    if (user) {
      req.user = user;
    }
  } catch {
    // Fall through with no req.user — the route's auth gate will 401.
  }
  return next();
}
