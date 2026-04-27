---
project: rssreader
status: production
status_description: "Live at secorp.net/rssreader; single-user (secorp@gmail.com); feature-stable, occasional small adds."
last_updated: 2026-04-25
last_updated_by:
  - agent:claude-opus-4-7
  - human:secorp
wiki_schema_version: 1
---

# AGENTS.md — RSS Reader

## What This Is

A personal RSS reader web application for a single user (`secorp@gmail.com`). Aggregates RSS feeds, tracks read/unread status, and provides a clean reading interface with mobile swipe-to-read. Hosted at **https://secorp.net/rssreader**.

## Status

**Production.** Backend, frontend, scheduler, and OAuth all implemented and live. Schema migrations done via raw SQL or `prisma db push`, not `prisma migrate dev`. No automated tests. Active maintenance: occasional small adds.

## Repository Layout

```
~/termag/projects/rssreader/        (canonical; ~/src/rssreader is a symlink to here)
├── backend/                        Node.js/Express API server
│   ├── src/
│   │   ├── index.ts               Entry: middleware, route registration
│   │   ├── middleware/
│   │   │   ├── auth.ts            ensureAuthenticated
│   │   │   └── passport.ts        Google OAuth (restricted to secorp@gmail.com)
│   │   ├── routes/
│   │   │   ├── auth.ts            /auth/google, /auth/google/callback, /auth/me, /auth/logout
│   │   │   ├── categories.ts      /api/categories CRUD + /api/categories/index
│   │   │   ├── feeds.ts           /api/feeds CRUD + /:id/refresh
│   │   │   ├── feedItems.ts       /api/feed-items with filtering/search/pagination
│   │   │   ├── readStatus.ts      mark-read/mark-unread/mark-all-read
│   │   │   └── history.ts         /api/history + /api/history/stats
│   │   ├── services/
│   │   │   ├── rssFeedService.ts  Parses RSS XML, saves items, extracts thumbnails
│   │   │   └── feedSchedulerService.ts  node-cron every 15 minutes
│   │   └── types/                 express.d.ts, connect-pg-simple.d.ts
│   ├── prisma/schema.prisma       (see Data & Schema)
│   ├── dist/                      Build output — DO NOT edit
│   └── .env                       Secrets (see Configuration)
├── frontend/                       React 18 + TypeScript SPA (CRA)
│   ├── src/
│   │   ├── App.tsx                BrowserRouter basename="/rssreader"
│   │   ├── App.css                All styles (single global CSS file)
│   │   ├── pages/                 LoginPage, ReaderPage (main UI)
│   │   ├── components/            Sidebar, FeedItemList, FeedItemCard, IndexView,
│   │   │                          HistoryView, AddFeedModal, AddCategoryModal, EditFeedModal
│   │   ├── contexts/AuthContext.tsx  useAuth() hook
│   │   ├── services/api.ts        Axios + all API functions
│   │   └── types/index.ts         All data types
│   ├── public/index.html          Uses %PUBLIC_URL% for asset paths (important!)
│   ├── .env.production            REACT_APP_API_URL=/rssreader
│   └── package.json               homepage: "/rssreader" — critical
├── rss-reader-apache.conf          Reference Apache snippet
├── deploy.sh, setup.sh, *.sh       Operational scripts (some one-shot, some still useful)
├── AGENTS.md                       This file
└── CLAUDE.md                       Stub: @AGENTS.md
```

## Architecture

```
Browser → https://secorp.net/rssreader
           ↓ Apache :443 (/etc/apache2/sites-enabled/secorp.conf, *:443 vhost)
           ├── /rssreader/static/* → /var/www/html/rss-reader/static/ (built React)
           ├── /rssreader/api/*    → http://127.0.0.1:3003/api/* (proxied)
           ├── /rssreader/auth/*   → http://127.0.0.1:3003/auth/* (proxied)
           └── /rssreader/*        → /var/www/html/rss-reader/index.html (Router fallback)

Backend: systemd "rss-reader" → /usr/bin/node /home/secorp/src/rssreader/backend/dist/index.js
  Listens on 127.0.0.1:3003 only (not public).

Database: PostgreSQL on localhost:5432, DB "rssreader".
```

The relevant Apache rewrite block:

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

**Trade-off: subpath deployment vs subdomain** — chose subpath under `secorp.net` to share the existing TLS cert and vhost. Cost: every asset path, the Router `basename`, the `homepage` field, and `REACT_APP_API_URL` must agree on `/rssreader`, and getting any one wrong breaks production. See Gotchas.

## Data & Schema

File: `backend/prisma/schema.prisma`.

| Model | Key fields |
|-------|-----------|
| **User** | id, googleId, email, name |
| **Category** | id, name, userId — `unique(userId, name)` |
| **Feed** | id, title, url, categoryId, userId, lastFetchedAt, lastFetchError — `unique(userId, url)` |
| **FeedItem** | id, feedId, title, link, guid, description, author, pubDate, thumbnail — `unique(feedId, guid)` |
| **ReadStatus** | id, feedItemId, userId, isRead, readAt, openedAt — `unique(feedItemId, userId)` |

**`ReadStatus` distinction:** `readAt` is set whenever an article is marked read by any means (click, toggle, bulk). `openedAt` is set ONLY when the user clicks to open the article in a new tab. The top-bar reading stats use `openedAt`, not `readAt`.

**Schema changes:** the project does not use `prisma migrate dev` (non-interactive in this env). Use `prisma db push --accept-data-loss` cautiously — the warning about the `session` table (managed by connect-pg-simple, not Prisma) is safe to ignore if you're only adding columns. For trickier changes use raw SQL via `psql`, then `npx prisma generate`.

## Configuration

`backend/.env`:

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

`frontend/.env.production`:

```
REACT_APP_API_URL=/rssreader
```

This is what makes axios send API calls to `/rssreader/api/...` in production. In development the baseURL is empty and calls go to the React dev server proxy.

OAuth: Google Console must list `https://secorp.net/rssreader/auth/google/callback` as an Authorized redirect URI. Only `secorp@gmail.com` can log in (hard-coded check in `passport.ts`). Sessions: 90-day rolling TTL, stored in PostgreSQL `session` table (connect-pg-simple), cookie named `rssreader.sid` scoped to `/rssreader` path to avoid conflicts with other services on `secorp.net`.

## Build, Run, Deploy

After backend changes:

```bash
cd /home/secorp/termag/projects/rssreader/backend
npm run build
sudo systemctl restart rss-reader
```

After frontend changes:

```bash
cd /home/secorp/termag/projects/rssreader/frontend
npm run build
sudo cp -r build/. /var/www/html/rss-reader/
```

If a subsequent `npm run build` fails with `EACCES: permission denied`, the previous `sudo cp` left `build/` root-owned:

```bash
sudo chown -R secorp:secorp /home/secorp/termag/projects/rssreader/frontend/build
```

## Observability & Maintenance

```bash
# Backend logs
sudo journalctl -u rss-reader -f

# Service status
sudo systemctl status rss-reader

# Manual feed refresh (per feed, via API)
curl -X POST http://127.0.0.1:3003/api/feeds/:id/refresh
```

The scheduler refreshes all feeds every 15 minutes (`feedSchedulerService.ts`, node-cron). Failures are recorded in `Feed.lastFetchError` and surface in the UI.

## Integration Surfaces

URL parameter navigation — ReaderPage syncs view state to URL params:

| Param | Effect |
|-------|--------|
| `?view=all` | All items |
| `?view=feed&feedId=5` | Single feed |
| `?view=category&categoryId=2` | Category view |
| `?view=index` | Index dashboard |
| `?view=history` | History view |
| `&unreadOnly=true` | Unread filter |
| `&search=foo` | Search query |

No webhooks, no socket.io, no external integrations beyond Google OAuth and inbound RSS.

## Gotchas

1. **Favicon paths** — `public/index.html` must use `%PUBLIC_URL%/favicon.svg`, not `/favicon.svg`. A hardcoded `/favicon.svg` resolves to the domain root, not `/rssreader/favicon.svg`.

2. **`homepage` in `package.json`** — must be `"/rssreader"`. Removing it breaks all asset paths in the production build.

3. **`basename` in `App.tsx`** — `<Router basename="/rssreader">` is required for React Router to work at a subpath.

4. **`REACT_APP_API_URL` in `.env.production`** — must be `/rssreader`. Without it, API calls go to `/api/...` instead of `/rssreader/api/...` and 404.

5. **Prisma schema changes** — don't use `prisma migrate dev` (interactive TTY). Use raw SQL (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`) then `npx prisma generate`. `prisma db push` works but warns about the connect-pg-simple `session` table (safe to ignore).

6. **Build directory ownership** — `sudo cp -r build/. /var/www/html/rss-reader/` leaves `build/` root-owned. Fix with `sudo chown -R secorp:secorp frontend/build` before the next `npm run build`.

7. **OAuth login URL** — `LoginPage.tsx` uses `window.location.href` to start the OAuth flow. The URL must be `/rssreader/auth/google`, not `/auth/google`. A hardcoded `/auth/google` 404s because Apache only proxies `/rssreader/auth/*`.

8. **Scroll preservation in unread-only mode** — When an article is marked read in unread-only mode (removing it from the list), `FeedItemList` saves scroll position via `useRef` before the update and restores it after. Don't break this when refactoring the list component.

9. **Reading stats count `openedAt`, not `isRead`** — see Data & Schema. Mark-as-read does not increment the visible reading stats; opening the article does.

## Related

**Other projects:**
- [colonization-cargo-tracker](../colonization-cargo-tracker/CLAUDE.md) — same subpath-deployment pattern; same Prisma schema-change conventions
- [meeting-slack-app](../meeting-slack-app/AGENTS.md) — sibling app on `secorp.net`, also subpath-deployed

**Topics:** none yet.

<!-- agent-wiki:backlinks-start -->
_No incoming links yet._
<!-- agent-wiki:backlinks-end -->
