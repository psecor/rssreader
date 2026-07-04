import express from 'express';
import session from 'express-session';
import passport from 'passport';
import cors from 'cors';
import dotenv from 'dotenv';
import pgSession from 'connect-pg-simple';
import pg from 'pg';

// Load environment variables
dotenv.config();

// Import routes and services
import { configurePassport } from './middleware/passport';
import { bearerAuth } from './middleware/bearerAuth';
import { ensureAuthenticatedWithSubscription } from './middleware/subscription';
import authRoutes from './routes/auth';
import meRoutes from './routes/me';
import categoriesRoutes from './routes/categories';
import feedsRoutes from './routes/feeds';
import feedItemsRoutes from './routes/feedItems';
import readStatusRoutes from './routes/readStatus';
import historyRoutes from './routes/history';
import { startFeedScheduler } from './services/feedSchedulerService';

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy - required when behind Apache reverse proxy
app.set('trust proxy', 1);

// Session store setup
const PgSession = pgSession(session);
const pgPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);

// Session configuration
app.use(
  session({
    store: new PgSession({
      pool: pgPool,
      tableName: 'session',
      createTableIfMissing: true,
      ttl: 90 * 24 * 60 * 60, // 90 days in seconds (must match cookie maxAge)
    }),
    name: 'rssreader.sid',
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset expiration on every request
    cookie: {
      path: '/',
      maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days in milliseconds
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    },
  })
);

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());
configurePassport();

// Mobile bearer-token fallback. No-ops when no Authorization header is
// present, so it leaves web/session requests untouched. When a valid bearer
// token is supplied, populates req.user — which is all that req.isAuthenticated()
// checks, so the existing ensureAuthenticated middleware accepts it as-is.
app.use(bearerAuth);

// Routes
app.use('/auth', authRoutes);

// /api/me is auth-gated but NOT subscription-gated — clients need it to detect
// the paywall case ("signed in but no active subscription") without a 402.
app.use('/api/me', meRoutes);

// All other /api/* routes require an active subscription in addition to auth.
app.use('/api/categories', ensureAuthenticatedWithSubscription, categoriesRoutes);
app.use('/api/feeds', ensureAuthenticatedWithSubscription, feedsRoutes);
app.use('/api/feed-items', ensureAuthenticatedWithSubscription, feedItemsRoutes);
app.use('/api/read-status', ensureAuthenticatedWithSubscription, readStatusRoutes);
app.use('/api/history', ensureAuthenticatedWithSubscription, historyRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Frontend URL: ${process.env.FRONTEND_URL}`);

  // Start the feed scheduler
  startFeedScheduler();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});
