# RSS Reader

A personal RSS reader web application with Google OAuth authentication. Hosted at **https://secorp.net/rssreader**.

## Features

- **Google OAuth 2.0** — restricted to secorp@gmail.com
- **Feed management** — organize feeds into categories, add/edit/delete feeds and categories
- **Automatic updates** — all feeds refresh every 15 minutes via background scheduler
- **Compact article list** — thumbnails, author, date, two-column layout at wide screens
- **Category pills** — each article shows which category it's from
- **Read/unread tracking** — per-article status with visual distinction
- **Swipe to read (mobile)** — swipe right on an article to mark as read
- **Unread badges** — sidebar shows unread counts per feed and per category
- **Search** — case-insensitive search across title and description
- **Unread filter** — toggle to show only unread articles
- **Scroll preservation** — position maintained when articles are removed in unread-only mode
- **Index view** — dashboard showing unread counts across all feeds
- **History view** — searchable archive of all articles you've opened
- **Reading stats** — always-visible top-bar stats: articles opened today / this week / this month / all time
- **Mobile-friendly** — hamburger menu, slide-in sidebar, touch-optimized layout
- **URL navigation** — all views are bookmarkable via URL parameters
- **RSS favicon** — orange RSS icon

## Tech Stack

**Backend:** Express + TypeScript, Prisma ORM, PostgreSQL, Passport.js, node-cron, rss-parser

**Frontend:** React 18 + TypeScript, React Router v6, Axios, CSS3

## URL Parameters

The app state is reflected in the URL and can be deep-linked:

| Parameter | Values | Description |
|-----------|--------|-------------|
| `view` | `all`, `feed`, `category`, `index`, `history` | Active view |
| `feedId` | number | Selected feed (when view=feed) |
| `categoryId` | number | Selected category (when view=category) |
| `unreadOnly` | `true` | Show only unread articles |
| `search` | string | Search query |

## API Endpoints

### Authentication
- `GET /auth/google` — Start OAuth flow
- `GET /auth/google/callback` — OAuth callback
- `POST /auth/logout` — Logout
- `GET /auth/me` — Get current user

### Categories
- `GET /api/categories` — List all with unread counts
- `GET /api/categories/index` — Dashboard index data
- `POST /api/categories` — Create `{ name }`
- `PUT /api/categories/:id` — Update `{ name }`
- `DELETE /api/categories/:id` — Delete (cascades to feeds and items)

### Feeds
- `GET /api/feeds` — List feeds (optional `?categoryId=`)
- `GET /api/feeds/:id` — Get single feed
- `POST /api/feeds` — Create `{ url, categoryId, title? }`
- `PUT /api/feeds/:id` — Update `{ title?, categoryId? }`
- `DELETE /api/feeds/:id` — Delete
- `POST /api/feeds/:id/refresh` — Manually trigger a fetch

### Feed Items
- `GET /api/feed-items` — Get articles
  - `?feedId=` / `?categoryId=` — filter by source
  - `?isRead=true/false` — filter by read status
  - `?search=` — search title and description
  - `?limit=50&offset=0` — pagination
- `GET /api/feed-items/:id` — Get single article

### Read Status
- `POST /api/read-status/mark-read` — `{ feedItemIds: number[], opened?: boolean }`
  - Pass `opened: true` when user clicks to open (records `openedAt` for stats)
- `POST /api/read-status/mark-unread` — `{ feedItemId: number }`
- `POST /api/read-status/mark-all-read` — `{ feedId? } | { categoryId? }`

### History
- `GET /api/history` — Paginated read history `?search=&limit=100&offset=0`
- `GET /api/history/stats` — Reading stats by time period:
  ```json
  { "today": 3, "week": 21, "month": 84, "allTime": 1203,
    "todayRead": 5, "weekRead": 30, "monthRead": 100, "allTimeRead": 1500 }
  ```
  (`today/week/month/allTime` = opened; `*Read` = marked read by any means)

### Health
- `GET /health` — Returns `{ "status": "ok" }`

## Development Notes

- Feed items are deduplicated by `guid` field (unique per feed)
- `ReadStatus.openedAt` is only set when articles are opened via click, not when toggled read
- Sessions stored in PostgreSQL (connect-pg-simple), 90-day rolling TTL
- Prisma schema changes: use raw SQL + `npx prisma generate` (avoid `migrate dev` in this env)
- See `CLAUDE.md` for agent-specific guidance including common pitfalls
