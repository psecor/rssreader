import jwt, { JwtPayload } from 'jsonwebtoken';

const MOBILE_TOKEN_TTL = '90d';

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'JWT_SECRET must be set — used to sign and verify mobile bearer tokens.'
    );
  }
  return secret;
}

export function signMobileToken(userId: number): string {
  return jwt.sign({ type: 'mobile' }, getSecret(), {
    subject: String(userId),
    expiresIn: MOBILE_TOKEN_TTL,
  });
}

export interface VerifiedMobileToken {
  userId: number;
}

export function verifyMobileToken(token: string): VerifiedMobileToken {
  const decoded = jwt.verify(token, getSecret()) as JwtPayload;
  if (!decoded.sub || (decoded as { type?: string }).type !== 'mobile') {
    throw new Error('Token is not a mobile bearer token');
  }
  const userId = Number.parseInt(decoded.sub, 10);
  if (!Number.isFinite(userId)) {
    throw new Error('Token subject is not a valid user id');
  }
  return { userId };
}
