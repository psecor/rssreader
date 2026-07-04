import type { Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

// Per-authenticated-user rate limit for /api/* routes. This is a "one buggy
// client isn't hammering us" guardrail, not a DoS defense — 300 req/min per
// user is generous enough to never bother a real reader but will catch retry
// loops and misbehaving background sync. Falls back to IP-keyed when the
// request is unauthenticated (e.g. mid-401 responses).
export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const userId = (req.user as { id?: number } | undefined)?.id;
    if (userId) return `u:${userId}`;
    return `ip:${ipKeyGenerator(req.ip ?? '')}`;
  },
  message: { error: 'rate_limited' },
});
