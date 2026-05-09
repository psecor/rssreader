# rssreader

A self-hosted RSS reader web app with Google OAuth authentication. Aggregates RSS feeds, tracks read/unread per article, and exposes a clean reading interface with mobile swipe gestures and a per-user reading history.

This repo holds:

- The **backend** — Express + TypeScript, Prisma + PostgreSQL, Passport (Google OAuth), node-cron scheduler, rss-parser
- The **frontend** — React 18 + TypeScript, React Router v6
- A **deploy bundle** — `setup.sh`, `deploy.sh`, an Apache vhost template, and `DEPLOYMENT.md`

It's intended for a single user or a small allowlist of users (e.g. a household). Authentication is Google OAuth; the allowlist is configured via the `ALLOWED_EMAILS` env var.

## Status

Feature-stable. Recent work has been small UX polish (in-app article lightbox) and security hardening (DOMPurify XSS sanitization for rendered RSS HTML).

## Prerequisites

- **Node.js** 20+
- **PostgreSQL** 14+
- **Google OAuth client** (Authorized redirect URI must match `GOOGLE_CALLBACK_URL`)
- **Apache** (or another reverse proxy with TLS) — only for production serving

## Quick start (local dev)

```bash
# 1. Clone, then create the local Postgres role + database:
DB_USER=rssreader DB_PASSWORD="$(openssl rand -hex 16)" ./setup.sh

# 2. Copy and fill in the backend env:
cp backend/.env.example backend/.env
#    Set DATABASE_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
#        GOOGLE_CALLBACK_URL, SESSION_SECRET, ALLOWED_EMAILS

# 3. Re-run setup to install deps + run migrations:
./setup.sh

# 4. Start backend and frontend:
cd backend && npm run dev          # :3001
cd frontend && npm start            # :3000
```

Open <http://localhost:3000> and sign in with one of the allowlisted Google accounts.

## Production deploy

See [DEPLOYMENT.md](DEPLOYMENT.md) for the full Apache + systemd walkthrough.

In short:

```bash
PROJECT_DIR="$(pwd)" SERVICE_USER=$USER \
FRONTEND_URL=https://example.com:3444 BACKEND_PORT=3003 \
  ./deploy.sh
```

The Apache vhost template at `rss-reader-apache.conf` has placeholders (`YOUR_DOMAIN`, `YOUR_PORT`, `YOUR_CERT_PATH`, `BACKEND_PORT`) that need to be filled in before the first deploy.

## Configuration

All backend configuration is via `backend/.env`. See `backend/.env.example` for the canonical list. Notable:

| Var | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | yes | OAuth credentials |
| `GOOGLE_CALLBACK_URL` | yes | Must match an Authorized redirect URI in Google Console |
| `SESSION_SECRET` | yes | Random string; rotating it logs everyone out |
| `FRONTEND_URL` | yes | Where the app redirects after OAuth |
| `ALLOWED_EMAILS` | yes | Comma-separated allowlist of Google account emails |
| `PORT` | no (default 3001) | Backend listen port |

## Repo layout

See [AGENTS.md](AGENTS.md) for an annotated tree, the architecture writeup, deployment topology, and the list of operational gotchas (subpath routing, session-cookie scoping, build-permission traps, etc.).

## License

[MIT](LICENSE)
