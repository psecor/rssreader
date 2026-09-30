---
project: rssreader
status: production
status_description: "Self-hosted Google-OAuth-gated RSS reader for a small allowlist of users; feature-stable, open-sourced 2026-05, and as of 2026-06 also exposes a bearer-token auth path for a mobile client alongside the browser session flow."
last_updated: 2026-07-29
last_updated_by:
  - agent:claude-opus-4-7
  - human:secorp
  - agent:sweeper-claude-opus-4-7
wiki_schema_version: 1
---

# AGENTS.md — RSS Reader

## What This Is

A self-hosted RSS reader web application. Aggregates RSS feeds, tracks read/unread status per user, and provides a clean reading interface with mobile swipe-to-read. Authentication is Google OAuth restricted to a configurable allowlist (`ALLOWED_EMAILS`), so it's well-suited to a single user or a small group (e.g. a household).

## Status

**Production-ready** and now publicly released as open source (LICENSE added 2026-05). Backend, frontend, scheduler, and OAuth all implemented. As of 2026-06 the backend also exposes a bearer-token auth flow for a mobile client, running alongside the existing browser session flow (see Architecture and Integration Surfaces). Schema migrations done via raw SQL or `prisma db push`, not `prisma migrate dev` (the latter is interactive and doesn't fit non-TTY deploy contexts). No automated tests yet — manual smoke testing only.

## Repository Layout

```
rssreader/
├── backend/                        Node.js/Express API server
│   ├── src/
│   │   ├── index.ts               Entry: middleware, route registration
│   │   ├── middleware/
│   │   │   ├── auth.ts            ensureAuthenticated (session cookie)
│   │   │   ├── bearerAuth.ts      Bearer-token auth for the mobile client (JWT)
│   │   │   └── passport.ts        Google OAuth (allowlisted via ALLOWED_EMAILS)
│   │   ├── routes/
│   │   │   ├── auth.ts            /auth/google, /auth/google/callback, /auth/me, /auth/logout,
│   │   │   │                      plus mobile token-exchange endpoints (see Integration Surfaces)
│   │   │   ├── categories.ts      /api/categories CRUD + /api/categories/index
│   │   │   ├── feeds.ts           /api/feeds CRUD + /:id/refresh
│   │   │   ├── feedItems.ts       /api/feed-items with filtering/search/pagination;
│   │   │   │                      accepts either session or bearer auth
│   │   │   ├── readStatus.ts      mark-read/mark-unread/mark-all-read
│   │   │   └── history.ts         /api/history + /api/history/stats
│   │   ├── services/
│   │   │   ├── rssFeedService.ts  Parses RSS XML, saves items, extracts thumbnails
│   │   │   ├── feedSchedulerService.ts  node-cron every 15 minutes
│   │   │   ├── googleVerify.ts    Verifies Google ID tokens from the mobile client
│   │   │   └── jwtService.ts      Issues/verifies app JWTs for the bearer flow
│   │   └── types/                 express.d.ts, connect-pg-simple.d.ts
│   ├── prisma/schema.prisma       (see Data & Schema)
│   ├── dist/                      Build output — do not edit
│   ├── .env.example               Canonical env var list
│   └── .env                       Secrets (gitignored; see Configuration)
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
│   └── package.json               homepage: "/rssreader" — critical; depends on dompurify
├── rss-reader-apache.conf          Apache vhost template (placeholders to fill)
├── deploy.sh, setup.sh             Operational scripts
├── DEPLOYMENT.md                   Production install walkthrough
├── README.md                       Public-facing overview
├── LICENSE                         Open-source license (added 2026-05 release)
├── AGENTS.md                       This file
└── CLAUDE.md                       Stub: @AGENTS.md
```

Note: an earlier era of this repo accumulated many ad-hoc operational shell scripts (`fix-auth.sh`, `update-thumbnails.sh`, `force-restart-backend.sh`, etc.). These were removed in the 2026-05 open-source-release cleanup. If you find references to them in old notes or git history, the canonical replacements are `deploy.sh` and `setup.sh`.

## Architecture

```
Browser → https://YOUR_DOMAIN/rssreader
           ↓ Apache :443 (TLS-terminating vhost)
           ├── /rssreader/static/* → /var/www/html/rss-reader/static/ (built React)
           ├── /rssreader/api/*    → http://127.0.0.1:BACKEND_PORT/api/*  (proxied)
           ├── /rssreader/auth/*   → http://127.0.0.1:BACKEND_PORT/auth/* (proxied)
           └── /rssreader/*        → /var/www/html/rss-reader/index.html (Router fallback)

Mobile client → https://YOUR_DOMAIN/rssreader/auth/* + /api/*
           (same Apache vhost, but authenticates with a bearer JWT instead of a session cookie)

Backend: systemd "rss-reader" → /usr/bin/node <PROJECT_DIR>/backend/dist/index.js
  Listens on 127.0.0.1:BACKEND_PORT only (not public).

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

**Trade-off: subpath deployment vs subdomain** — the default deployment serves the app under a subpath (`/rssreader`) so it can share an existing TLS cert and vhost with other apps on the same domain. Cost: every asset path, the Router `basename`, the `homepage` field in `package.json`, and `REACT_APP_API_URL` must agree on `/rssreader`, and getting any one wrong breaks production. See Gotchas. If you'd rather run on its own subdomain, the bundled `rss-reader-apache.conf` shows a port-based vhost as an alternative.

**Dual authentication surface** — the browser SPA authenticates via Google OAuth → session cookie (`rssreader.sid`, scoped to `/rssreader`). The mobile client instead obtains a Google ID token natively, posts it to a token-exchange endpoint (`backend/src/services/googleVerify.ts` validates it), and receives an app-issued JWT (`backend/src/services/jwtService.ts`) which it sends as `Authorization: Bearer <jwt>` on subsequent `/api/*` calls. API route handlers that accept both flows do so by composing `ensureAuthenticated` with `bearerAuth` middleware; the user identity resolved by either path is the same `User` row, and the `ALLOWED_EMAILS` allowlist applies to both.

## Data & Schema

File: `backend/prisma/schema.prisma`.

| Model | Key fields |
|-------|-----------|
| **User** | id, googleId, email, name |
| **Category** | id, name, userId — `unique(userId, name)` |
| **Feed** | id, title, url, categoryId, userId, lastFetchedAt, lastFetchError — `unique(userId, url)` |
| **FeedItem** | id, feedId, title, link, guid, description, author, pubDate, thumbnail — `unique(feedId, guid)` |
| **ReadStatus** | id, feedItemId, userId, isRead, readAt, openedAt, updatedAt — `unique(feedItemId, userId)` |

**`ReadStatus` distinction:** `readAt` is set whenever an article is marked read by any means (click, toggle, bulk). `openedAt` is set ONLY when the user clicks to open the article in a new tab. The top-bar reading stats use `openedAt`, not `readAt`.

**`ReadStatus.updatedAt`** (added 2026-06 in migration `20260614230000_add_readstatus_updated_at`) is bumped on every mutation of a `ReadStatus` row and is the cursor used by the mobile client's delta-sync endpoints (see Integration Surfaces). It is maintained by the write paths in `backend/src/routes/readStatus.ts`; if you add new code paths that mutate `ReadStatus`, make sure they also touch `updatedAt` or delta sync will miss changes.

**Schema changes:** the project does not use `prisma migrate dev` (non-interactive in this env). Use `prisma db push --accept-data-loss` cautiously — the warning about the `session` table (managed by connect-pg-simple, not Prisma) is safe to ignore if you're only adding columns. For trickier changes use raw SQL via `psql`, then `npx prisma generate`. The `20260614...` migration is checked in under `backend/prisma/migrations/` as a reference for the shape of raw-SQL migrations in this repo.

## Configuration

`backend/.env` (see `backend/.env.example` for the canonical list):

```
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/rssreader"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_CALLBACK_URL="https://YOUR_DOMAIN/rssreader/auth/google/callback"
SESSION_SECRET="..."
FRONTEND_URL="https://YOUR_DOMAIN/rssreader"
ALLOWED_EMAILS="alice@example.com,bob@example.com"
PORT=3003
NODE_ENV="production"
```

`backend/.env.example` also lists the additional vars required by the mobile bearer-auth flow added in 2026-06 (JWT signing secret and the Google client ID(s) accepted from native clients). Always treat `backend/.env.example` as the source of truth for the full set — copy from it when provisioning a new deploy.

`frontend/.env.production`:

```
REACT_APP_API_URL=/rssreader
```

This is what makes axios send API calls to `/rssreader/api/...` in production. In development the baseURL is empty and calls go to the React dev server proxy.

OAuth: Google Console must list `https://YOUR_DOMAIN/rssreader/auth/google/callback` as an Authorized redirect URI. Only addresses listed in `ALLOWED_EMAILS` can log in (`backend/src/middleware/passport.ts`); the same allowlist gates the mobile bearer flow via `backend/src/services/googleVerify.ts`. Sessions: 90-day rolling TTL, stored in PostgreSQL `session` table (connect-pg-simple), cookie named `rssreader.sid` scoped to `/rssreader` path to avoid conflicts with other services on the same domain. Mobile JWTs are signed and verified by `backend/src/services/jwtService.ts`; they do not touch the `session` table.

## Build, Run, Deploy

After backend changes:

```bash
cd backend
npm run build
sudo systemctl restart rss-reader
```

After frontend changes:

```bash
cd frontend
npm run build
sudo cp -r build/. /var/www/html/rss-reader/
```

If a subsequent `npm run build` fails with `EACCES: permission denied`, the previous `sudo cp` left `build/` root-owned:

```bash
sudo chown -R "$USER:$USER" frontend/build
```

For first-time install, see [DEPLOYMENT.md](DEPLOYMENT.md) and the bundled `setup.sh` / `deploy.sh`.

## Observability & Maintenance

```bash
# Backend logs
sudo journalctl -u rss-reader -f

# Service status
sudo systemctl status rss-reader

# Manual feed refresh (per feed, via API; auth required)
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

Mobile bearer-auth endpoints (added 2026-06, in `backend/src/routes/auth.ts`) — used by a native mobile client that already holds a Google ID token. The client posts the Google ID token, the backend verifies it via `googleVerify.ts`, checks `ALLOWED_EMAILS`, and returns an app-issued JWT. Subsequent calls to `/api/*` send `Authorization: Bearer <jwt>` and pass through `middleware/bearerAuth.ts`. Endpoints that accept either session or bearer auth (notably `/api/feed-items`) compose both middlewares.

Delta sync for the mobile client (added 2026-06-14, in `backend/src/routes/feedItems.ts` and `backend/src/routes/readStatus.ts`) — lets the mobile client pull only what has changed since its last sync. `/api/feed-items` accepts a cursor parameter to return items newer than a given timestamp, and `/api/read-status` exposes an endpoint keyed on `ReadStatus.updatedAt` so the client can reconcile per-item read/opened state without refetching the full list. Both accept either session or bearer auth. When adding new state that the mobile client needs to observe, either extend one of these endpoints or add a parallel `updatedAt`-cursored endpoint — do not require the client to poll full collections.

No webhooks, no socket.io, no external integrations beyond Google OAuth and inbound RSS.

## Gotchas

1. **Favicon paths** — `public/index.html` must use `%PUBLIC_URL%/favicon.svg`, not `/favicon.svg`. A hardcoded `/favicon.svg` resolves to the domain root, not `/rssreader/favicon.svg`.

2. **`homepage` in `package.json`** — must be `"/rssreader"`. Removing it breaks all asset paths in the production build.

3. **`basename` in `App.tsx`** — `<Router basename="/rssreader">` is required for React Router to work at a subpath.

4. **`REACT_APP_API_URL` in `.env.production`** — must be `/rssreader`. Without it, API calls go to `/api/...` instead of `/rssreader/api/...` and 404.

5. **Prisma schema changes** — don't use `prisma migrate dev` (interactive TTY). Use raw SQL (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`) then `npx prisma generate`. `prisma db push` works but warns about the connect-pg-simple `session` table (safe to ignore).

6. **Build directory ownership** — `sudo cp -r build/. /var/www/html/rss-reader/` leaves `build/` root-owned. Fix with `sudo chown -R "$USER:$USER" frontend/build` before the next `npm run build`.

7. **OAuth login URL** — `LoginPage.tsx` uses `window.location.href` to start the OAuth flow. The URL must be `/rssreader/auth/google`, not `/auth/google`. A hardcoded `/auth/google` 404s because Apache only proxies `/rssreader/auth/*`.

8. **Scroll preservation in unread-only mode** — When an article is marked read in unread-only mode (removing it from the list), `FeedItemList` saves scroll position via `useRef` before the update and restores it after. Don't break this when refactoring the list component.

9. **Reading stats count `openedAt`, not `isRead`** — see Data & Schema. Mark-as-read does not increment the visible reading stats; opening the article does.

10. **Session cookie path must match the subpath** — the session cookie is scoped to `/rssreader` (set in `backend/src/index.ts`). If you change the deployment subpath or remove the `path` option, sessions will leak across other apps on the same domain or fail to be sent on `/rssreader/*` requests. This was a real bug fixed in 2026-04.

11. **Article lightbox and mobile viewport** — `FeedItemCard` includes an in-app lightbox for opening articles without leaving the reader. On mobile, the lightbox interacts with viewport scrolling: `App.css` contains specific rules to prevent body-scroll-lock issues and keep the lightbox content scrollable. Refactor touch behavior here carefully — desktop testing alone won't catch regressions.

12. **RSS HTML must be sanitized with DOMPurify** — feed item bodies are arbitrary third-party HTML and are rendered via `dangerouslySetInnerHTML` in `FeedItemCard` (notably inside the lightbox). All such HTML must pass through DOMPurify first. A 2026-05 XSS fix added this; do not remove the sanitization step or render raw `description`/content fields directly. If adding new surfaces that render feed HTML (e.g. preview tooltips, summaries), sanitize there too.

13. **Dual auth flows must stay in parity** — any new `/api/*` route that browser clients can hit must also accept the mobile bearer JWT (compose `ensureAuthenticated` with `bearerAuth`), and vice versa. The allowlist check (`ALLOWED_EMAILS`) lives in two places — `middleware/passport.ts` for the session flow and `services/googleVerify.ts` for the bearer flow — and both must be updated together if the allowlist semantics change. Likewise, revoking access means the user has to be removed from `ALLOWED_EMAILS` *and* any outstanding mobile JWT has to expire or be rotated; there is no server-side JWT revocation list.

## Related

**Topics:** none yet.

<!-- agent-wiki:backlinks-start -->
- [rssreader-ios](../rssreader-ios/AGENTS.md) — What This Is, Related
<!-- agent-wiki:backlinks-end -->
