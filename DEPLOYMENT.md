# Deployment Guide

## Current Production Setup

| Item | Value |
|------|-------|
| Public URL | https://secorp.net/rssreader |
| Backend port | localhost:3003 (internal only) |
| Frontend files | /var/www/html/rss-reader/ |
| Apache config | /etc/apache2/sites-enabled/secorp.conf (443 vhost) |
| Systemd service | rss-reader |
| Database | PostgreSQL, database: rssreader, user: secorp |

---

## Routine Update Commands

### Backend change
```bash
cd /home/secorp/src/rssreader/backend
npm run build
sudo systemctl restart rss-reader
```

### Frontend change
```bash
cd /home/secorp/src/rssreader/frontend
npm run build
sudo cp -r build/. /var/www/html/rss-reader/
```

> **Note:** If `npm run build` fails with `EACCES: permission denied`, the build directory is owned by root from a previous `sudo cp`. Fix with:
> ```bash
> sudo chown -R secorp:secorp /home/secorp/src/rssreader/frontend/build
> ```

### Both changed
```bash
cd /home/secorp/src/rssreader/backend && npm run build && sudo systemctl restart rss-reader
cd /home/secorp/src/rssreader/frontend && npm run build && sudo cp -r build/. /var/www/html/rss-reader/
```

---

## Monitoring & Logs

```bash
# Backend status
sudo systemctl status rss-reader

# Backend logs (live)
sudo journalctl -u rss-reader -f

# Apache error log
sudo tail -f /var/log/apache2/error.log

# Health check
curl http://localhost:3003/health
```

---

## Apache Configuration

The RSS reader is served as a subpath of the main secorp.net HTTPS vhost. The relevant block in `/etc/apache2/sites-enabled/secorp.conf` (inside `<VirtualHost *:443>`):

```apache
Alias /rssreader /var/www/html/rss-reader

<Directory /var/www/html/rss-reader>
    Options -Indexes +FollowSymLinks
    AllowOverride None
    Require all granted
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

After editing Apache config:
```bash
sudo apachectl configtest && sudo systemctl reload apache2
```

---

## Systemd Service

File: `/etc/systemd/system/rss-reader.service`

```ini
[Unit]
Description=RSS Reader Backend
After=network.target postgresql.service

[Service]
Type=simple
User=secorp
WorkingDirectory=/home/secorp/src/rssreader/backend
ExecStart=/usr/bin/node /home/secorp/src/rssreader/backend/dist/index.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload   # after editing the service file
sudo systemctl enable rss-reader
sudo systemctl start rss-reader
```

---

## Environment Variables

File: `backend/.env`

```bash
DATABASE_URL="postgresql://secorp:REDACTED@localhost:5432/rssreader"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_CALLBACK_URL="https://secorp.net/rssreader/auth/google/callback"
SESSION_SECRET="..."           # generate: openssl rand -base64 32
FRONTEND_URL="https://secorp.net/rssreader"
PORT=3003
NODE_ENV="production"
```

File: `frontend/.env.production`
```
REACT_APP_API_URL=/rssreader
```

---

## Google OAuth Configuration

In [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → OAuth 2.0 Client:

- **Authorized JavaScript origins:** `https://secorp.net`
- **Authorized redirect URIs:** `https://secorp.net/rssreader/auth/google/callback`

If you change the callback URL, update both Google Console AND `GOOGLE_CALLBACK_URL` in `backend/.env`, then restart the backend.

---

## Database

```bash
# Connect
psql -U secorp -d rssreader

# Check tables
\dt

# Run migrations (no interactive TTY available, so use raw SQL)
psql -U secorp -d rssreader -c "ALTER TABLE \"ReadStatus\" ADD COLUMN IF NOT EXISTS \"newCol\" TEXT;"

# Then regenerate Prisma client
cd /home/secorp/src/rssreader/backend
npx prisma generate
```

> **Do not use** `prisma migrate dev` — it requires an interactive terminal. Use raw SQL + `npx prisma generate` for schema changes, or `prisma db push --accept-data-loss` (the `--accept-data-loss` flag is needed because of the `session` table managed by connect-pg-simple — this is safe as long as you're not dropping columns).

---

## Fresh Installation

1. **Install dependencies:**
   ```bash
   cd /home/secorp/src/rssreader/backend && npm install
   cd /home/secorp/src/rssreader/frontend && npm install
   ```

2. **Set up PostgreSQL:**
   ```bash
   sudo -u postgres psql -c "CREATE USER secorp WITH PASSWORD 'REDACTED' CREATEDB;"
   sudo -u postgres psql -c "CREATE DATABASE rssreader OWNER secorp;"
   ```

3. **Run Prisma migrations:**
   ```bash
   cd /home/secorp/src/rssreader/backend
   npx prisma migrate deploy
   npx prisma generate
   ```

4. **Configure `backend/.env`** (see Environment Variables above)

5. **Build and deploy backend:**
   ```bash
   cd /home/secorp/src/rssreader/backend
   npm run build
   sudo systemctl enable rss-reader && sudo systemctl start rss-reader
   ```

6. **Build and deploy frontend:**
   ```bash
   cd /home/secorp/src/rssreader/frontend
   npm run build
   sudo mkdir -p /var/www/html/rss-reader
   sudo cp -r build/. /var/www/html/rss-reader/
   sudo chown -R www-data:www-data /var/www/html/rss-reader
   ```

7. **Configure Apache** (add block from above to `secorp.conf`), then:
   ```bash
   sudo apachectl configtest && sudo systemctl reload apache2
   ```

8. **Configure Google Console** with the redirect URI above

---

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Blank page in browser | Browser console for JS errors; check `index.html` references correct JS hash |
| API calls 404 | Verify `REACT_APP_API_URL=/rssreader` in `frontend/.env.production` and rebuild |
| OAuth redirect error | Callback URL in Google Console must exactly match `GOOGLE_CALLBACK_URL` in .env |
| Backend won't start | `sudo journalctl -u rss-reader -n 50`; check .env is present and valid |
| Build permission error | `sudo chown -R secorp:secorp frontend/build` |
| Favicon missing | Ensure `public/index.html` uses `%PUBLIC_URL%/favicon.svg` not `/favicon.svg` |
| Session lost on restart | Normal if session table was dropped; sessions persist across restarts otherwise |
