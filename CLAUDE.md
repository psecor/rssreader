# CLAUDE.md — RSS Reader Project Guide for AI Agents

This file is intended to give future AI agents (Claude, etc.) a full understanding of this project so they can contribute effectively without needing to re-explore everything from scratch.

---

## What This Is

A personal RSS reader web application for a single user (secorp@gmail.com). It aggregates RSS feeds, tracks read/unread status, and provides a clean reading interface. Hosted at **https://secorp.net/rssreader**.

---

## Repository Layout

```
/home/secorp/src/rssreader/
├── backend/                        # Node.js/Express API server
│   ├── src/
│   │   ├── index.ts               # Entry point, middleware, route registration
│   │   ├── middleware/
│   │   │   ├── auth.ts            # ensureAuthenticated middleware
│   │   │   └── passport.ts        # Google OAuth strategy (restricted to secorp@gmail.com)
│   │   ├── routes/
│   │   │   ├── auth.ts            # /auth/google, /auth/google/callback, /auth/me, /auth/logout
│   │   │   ├── categories.ts      # /api/categories CRUD + /api/categories/index
│   │   │   ├── feeds.ts           # /api/feeds CRUD + /:id/refresh
│   │   │   ├── feedItems.ts       # /api/feed-items with filtering/search/pagination
│   │   │   ├── readStatus.ts      # /api/read-status/mark-read, mark-unread, mark-all-read
│   │   │   └── history.ts         # /api/history (list) + /api/history/stats
│   │   ├── services/
│   │   │   ├── rssFeedService.ts  # Parses RSS XML, saves items, extracts thumbnails
│   │   │   └── feedSchedulerService.ts  # node-cron job, runs every 15 minutes
│   │   └── types/
│   │       ├── express.d.ts       # Extends Express Request with user field
│   │       └── connect-pg-simple.d.ts  # Adds ttl option to PgSessionOptions
│   ├── prisma/
│   │   └── schema.prisma          # Database schema (see below)
│   ├── dist/                      # Compiled JS — DO NOT edit, rebuild with npm run build
│   └── .env                       # Secrets and config (see Environment Variables below)
├── frontend/                       # React 18 + TypeScript SPA
│   ├── src/
│   │   ├── App.tsx                # BrowserRouter with basename="/rssreader"
│   │   ├── App.css                # All styles (single global CSS file)
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx      # Google sign-in button
│   │   │   └── ReaderPage.tsx     # Main UI — all state, URL params, data loading
│   │   ├── components/
│   │   │   ├── Sidebar.tsx        # Category/feed nav, unread badges, Add Feed button
│   │   │   ├── FeedItemList.tsx   # Article list with scroll preservation
│   │   │   ├── FeedItemCard.tsx   # Article card with swipe-to-read (mobile)
│   │   │   ├── IndexView.tsx      # Dashboard with unread counts per feed
│   │   │   ├── HistoryView.tsx    # Searchable read article history
│   │   │   ├── AddFeedModal.tsx
│   │   │   ├── AddCategoryModal.tsx
│   │   │   └── EditFeedModal.tsx
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx    # useAuth() hook — user, loading, logout
│   │   ├── services/
│   │   │   └── api.ts             # Axios instance + all API functions
│   │   └── types/
│   │       └── index.ts           # TypeScript interfaces for all data types
│   ├── public/
│   │   ├── index.html             # Uses %PUBLIC_URL% for favicon paths (important!)
│   │   └── favicon.svg            # Orange RSS icon
│   ├── .env.production            # Sets REACT_APP_API_URL=/rssreader for production build
│   └── package.json               # homepage: "/rssreader" — critical for asset paths
└── CLAUDE.md                      # This file
```

---

## Database Schema (Prisma)

File: `backend/prisma/schema.prisma`

| Model | Key Fields |
|-------|-----------|
| **User** | id, googleId, email, name |
| **Category** | id, name, userId — unique(userId, name) |
| **Feed** | id, title, url, categoryId, userId, lastFetchedAt, lastFetchError — unique(userId, url) |
| **FeedItem** | id, feedId, title, link, guid, description, author, pubDate, thumbnail — unique(feedId, guid) |
| **ReadStatus** | id, feedItemId, userId, isRead, readAt, openedAt — unique(feedItemId, userId) |

**Important `ReadStatus` distinction:**
- `readAt` — set whenever an article is marked read (by any means: click, toggle, bulk)
- `openedAt` — set ONLY when user clicks to open the article in a new tab (tracks actual engagement)
- The top-bar reading stats use `openedAt` counts, not `readAt`

**Schema changes without git:** The project does not use `prisma migrate dev` (non-interactive in this env). Use `prisma db push --accept-data-loss` cautiously (it will warn about the `session` table which is managed by connect-pg-simple, not Prisma — that warning is safe to ignore with `--accept-data-loss` if you're only adding columns). Alternatively, use raw SQL via `psql`.

---

## Environment Variables

File: `backend/.env`

```
DATABASE_URL="postgresql://secorp:REDACTED@localhost:5432/rssreader"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_CALLBACK_URL="https://secorp.net/rssreader/auth/google/callback"
SESSION_SECRET="..."
FRONTEND_URL="https://secorp.net/rssreader"
PORT=3003
NODE_ENV="production"
```

File: `frontend/.env.production`
```
REACT_APP_API_URL=/rssreader
```
This is what makes axios send API calls to `/rssreader/api/...` in production.

---

## How the Frontend API Calls Work

The axios instance in `services/api.ts` uses `baseURL: process.env.REACT_APP_API_URL || ''`.

- In **production** (`.env.production`): `REACT_APP_API_URL=/rssreader`, so a call to `/api/categories` becomes a request to `https://secorp.net/rssreader/api/categories`, which Apache proxies to `localhost:3003/api/categories`.
- In **development**: baseURL is empty, so calls go to the React dev server proxy (configure `proxy` in package.json if needed).

---

## Deployment Architecture

```
Browser → https://secorp.net/rssreader
           ↓ Apache (port 443, /etc/apache2/sites-enabled/secorp.conf)
           ├── /rssreader/static/* → /var/www/html/rss-reader/static/ (static files)
           ├── /rssreader/api/*    → http://127.0.0.1:3003/api/* (proxied)
           ├── /rssreader/auth/*   → http://127.0.0.1:3003/auth/* (proxied)
           └── /rssreader/*        → /var/www/html/rss-reader/index.html (React Router)

Backend: systemd service "rss-reader"
  → /usr/bin/node /home/secorp/src/rssreader/backend/dist/index.js
  → listens on localhost:3003 only (not public)

Database: PostgreSQL on localhost:5432, database "rssreader"
```

**Apache config location:** `/etc/apache2/sites-enabled/secorp.conf` (the `<VirtualHost *:443>` block)

The relevant section looks like this:
```apache
Alias /rssreader /var/www/html/rss-reader
<Directory /var/www/html/rss-reader>
    RewriteEngine On
    RewriteBase /rssreader/
    RewriteRule ^index\.html$ - [L]
    RewriteCond %{REQUEST_URI} !^/rssreader/api
    RewriteCond %{REQUEST_URI} !^/rssreader/auth
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /rssreader/index.html [L]
</Directory>
ProxyPass /rssreader/api http://127.0.0.1:3003/api
ProxyPassReverse /rssreader/api http://127.0.0.1:3003/api
ProxyPass /rssreader/auth http://127.0.0.1:3003/auth
ProxyPassReverse /rssreader/auth http://127.0.0.1:3003/auth
```

---

## Standard Deploy Commands

After making backend changes:
```bash
cd /home/secorp/src/rssreader/backend
npm run build
sudo systemctl restart rss-reader
```

After making frontend changes:
```bash
cd /home/secorp/src/rssreader/frontend
npm run build
sudo cp -r build/. /var/www/html/rss-reader/
```

**Watch out:** Previous `sudo cp` runs leave the `build/` directory owned by root. If a subsequent build fails with `EACCES: permission denied`, fix with:
```bash
sudo chown -R secorp:secorp /home/secorp/src/rssreader/frontend/build
```

Check backend logs:
```bash
sudo journalctl -u rss-reader -f
```

---

## Key Frontend Behaviors

**URL parameter navigation** — ReaderPage syncs view state to URL params:
- `?view=all` — all items
- `?view=feed&feedId=5` — single feed
- `?view=category&categoryId=2` — category
- `?view=index` — Index dashboard
- `?view=history` — History view
- `&unreadOnly=true` — unread filter
- `&search=foo` — search query

**Scroll preservation** — When an article is marked read in "unread only" mode (removing it from the list), FeedItemList saves scroll position via `useRef` before the update and restores it after.

**Swipe to read (mobile)** — FeedItemCard tracks touch events. Swipe right >80px on an unread card marks it as read. Uses `translateX` CSS transform for live feedback, green background revealed underneath.

**Reading stats in top bar** — Always visible when logged in. Counts `openedAt` (clicked to open), not just `isRead`. Refreshes after every article interaction.

**Category pills** — Each article card shows a small `CATEGORY` pill before the title. The backend includes `feed.category.name` in the feed-items response.

---

## Google OAuth Notes

- Only `secorp@gmail.com` can log in (hard-coded check in `backend/src/middleware/passport.ts`)
- Authorized redirect URI in Google Console: `https://secorp.net/rssreader/auth/google/callback`
- Sessions: 90-day rolling TTL, stored in PostgreSQL `session` table, cookie named `rssreader.sid` scoped to `/rssreader` path (avoids conflicts with other services on secorp.net)
- If you change `GOOGLE_CALLBACK_URL` in `.env`, you must also update Google Console AND restart the backend

---

## Things That Are Easy to Get Wrong

1. **Favicon paths** — `public/index.html` must use `%PUBLIC_URL%/favicon.svg`, not `/favicon.svg`. A hardcoded `/favicon.svg` resolves to the domain root, not `/rssreader/favicon.svg`.

2. **`homepage` in package.json** — Must be `"/rssreader"`. Removing this breaks all asset paths in the production build.

3. **`basename` in App.tsx** — `<Router basename="/rssreader">` is required for React Router to work at a subpath.

4. **`REACT_APP_API_URL` in `.env.production`** — Must be `/rssreader`. Without this, API calls go to `/api/...` instead of `/rssreader/api/...` and get 404s.

5. **Prisma schema changes** — Don't use `prisma migrate dev` (requires interactive TTY). Use raw SQL (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`) then `npx prisma generate` to regenerate the client. Alternatively use `prisma db push` but be aware it warns about the `session` table (safe to ignore).

6. **Build directory ownership** — `sudo cp -r build/. /var/www/html/rss-reader/` leaves files owned by root in the build dir. Next `npm run build` will fail. Fix with `sudo chown -R secorp:secorp frontend/build`.

7. **OAuth login URL** — `LoginPage.tsx` uses `window.location.href` to start the OAuth flow. This must point to `/rssreader/auth/google`, not `/auth/google`. A hardcoded `/auth/google` will 404 because Apache only proxies the `/rssreader/auth/*` path.
