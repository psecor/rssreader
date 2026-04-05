import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export function configurePassport() {
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

          // Restrict to secorp@gmail.com
          if (email !== 'secorp@gmail.com') {
            return done(new Error('Unauthorized email address'));
          }

          // Find or create user
          let user = await prisma.user.findUnique({
            where: { googleId: profile.id },
          });

          if (!user) {
            user = await prisma.user.create({
              data: {
                googleId: profile.id,
                email: email,
                name: profile.displayName,
                refreshToken: refreshToken,
              },
            });
          } else {
            // Update refresh token if changed
            if (refreshToken && user.refreshToken !== refreshToken) {
              user = await prisma.user.update({
                where: { id: user.id },
                data: { refreshToken },
              });
            }
          }

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
