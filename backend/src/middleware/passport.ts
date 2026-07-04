import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function getAllowedEmails(): Set<string> {
  const raw = process.env.ALLOWED_EMAILS;
  if (!raw) {
    throw new Error(
      'ALLOWED_EMAILS must be set — comma-separated list of Google account emails permitted to log in.',
    );
  }
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0),
  );
}

export function configurePassport() {
  const allowedEmails = getAllowedEmails();

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: process.env.GOOGLE_CALLBACK_URL!,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;

          if (!email) {
            return done(new Error('No email found in Google profile'));
          }

          const normalizedEmail = email.toLowerCase();

          if (!allowedEmails.has(normalizedEmail)) {
            return done(new Error('Unauthorized email address'));
          }

          // Look up by googleId first; fall back to email to attach the real
          // googleId onto a founder-provisioned placeholder row (see admin CLI
          // grant-founder).
          let user = await prisma.user.findUnique({
            where: { googleId: profile.id },
          });

          if (!user) {
            const byEmail = await prisma.user.findUnique({ where: { email } });
            if (byEmail) {
              user = await prisma.user.update({
                where: { id: byEmail.id },
                data: {
                  googleId: profile.id,
                  name: profile.displayName ?? byEmail.name,
                  refreshToken,
                },
              });
            }
          } else if (refreshToken && user.refreshToken !== refreshToken) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: { refreshToken },
            });
          }

          if (!user) {
            user = await prisma.user.create({
              data: {
                googleId: profile.id,
                email,
                name: profile.displayName,
                refreshToken,
              },
            });
          }

          // Auto-provision a founder subscription for anyone in the ALLOWED_EMAILS
          // safety list who doesn't yet have one. Keeps beta testers unblocked
          // without a manual grant-founder step per email.
          await prisma.subscription.upsert({
            where: { userId: user.id },
            create: {
              userId: user.id,
              status: 'active',
              source: 'founder',
              expiresAt: null,
            },
            update: {},
          });

          return done(null, user);
        } catch (error) {
          return done(error as Error);
        }
      }
    )
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          googleId: true,
          email: true,
          name: true,
        },
      });
      done(null, user);
    } catch (error) {
      done(error);
    }
  });
}
