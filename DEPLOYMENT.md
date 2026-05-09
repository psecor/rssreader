# Deployment Guide

This guide covers a production install behind Apache, with the app served at a subpath (e.g. `https://example.com/rssreader`). For an architectural overview see [AGENTS.md](AGENTS.md).

## Reference setup

| Item | Value |
|------|-------|
| Public URL | `https://YOUR_DOMAIN/rssreader` |
| Backend port | `127.0.0.1:3003` (internal only) |
| Frontend files | `/var/www/html/rss-reader/` |
| Apache config | wherever the matching vhost lives (see below) |
| Systemd service | `rss-reader` |
| Database | PostgreSQL, database: `rssreader` |

You'll see `YOUR_DOMAIN` and `$PROJECT_DIR` used as placeholders below. `$PROJECT_DIR` is wherever you've checked out the rssreader repo.

---

## Routine update commands

### Backend change
```bash
cd "$PROJECT_DIR/backend"
npm run build
sudo systemctl restart rss-reader
```

### Frontend change
```bash
cd "$PROJECT_DIR/frontend"
npm run build
sudo cp -r build/. /var/www/html/rss-reader/
```

> **Note:** If `npm run build` fails with `EACCES: permission denied`, the build directory is owned by root from a previous `sudo cp`. Fix with:
> ```bash
> sudo chown -R "$USER:$USER" "$PROJECT_DIR/frontend/build"
> ```

### Both changed
```bash
cd "$PROJECT_DIR/backend"  && npm run build && sudo systemctl restart rss-reader
cd "$PROJECT_DIR/frontend" && npm run build && sudo cp -r build/. /var/www/html/rss-reader/
```

---

## Monitoring & logs

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

## Apache configuration

Two deployment shapes are supported:

1. **Subpath under an existing vhost** (preferred — shares an existing TLS cert). Add the block below to your existing `<VirtualHost *:443>`.
2. **Dedicated port-based vhost.** See the bundled `rss-reader-apache.conf` template (placeholders for domain, port, cert paths, backend port).

For the subpath layout, add this inside your existing 443 vhost:

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

## Systemd service

`deploy.sh` writes this for you. The resulting `/etc/systemd/system/rss-reader.service` looks like:

```ini
[Unit]
Description=RSS Reader Backend
After=network.target postgresql.service

[Service]
Type=simple
User=YOUR_SERVICE_USER
WorkingDirectory=$PROJECT_DIR/backend
ExecStart=/usr/bin/node $PROJECT_DIR/backend/dist/index.js
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

## Environment variables

`backend/.env` (see `backend/.env.example` for the full list and defaults):

```bash
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/rssreader"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_CALLBACK_URL="https://YOUR_DOMAIN/rssreader/auth/google/callback"
SESSION_SECRET="..."           # generate: openssl rand -base64 32
FRONTEND_URL="https://YOUR_DOMAIN/rssreader"
ALLOWED_EMAILS="alice@example.com,bob@example.com"
PORT=3003
NODE_ENV="production"
```

`frontend/.env.production`:
```
REACT_APP_API_URL=/rssreader
```

---

## Google OAuth configuration

In [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → OAuth 2.0 Client:

- **Authorized JavaScript origins:** `https://YOUR_DOMAIN`
- **Authorized redirect URIs:** `https://YOUR_DOMAIN/rssreader/auth/google/callback`

Each address in `ALLOWED_EMAILS` must also be added as a Test User on the OAuth consent screen until you publish the app.

If you change the callback URL, update both Google Console AND `GOOGLE_CALLBACK_URL` in `backend/.env`, then restart the backend.

---

## Database

```bash
# Connect
psql -U "$DB_USER" -d rssreader

# Check tables
\dt

# Run migrations (no interactive TTY available, so use raw SQL)
psql -U "$DB_USER" -d rssreader -c "ALTER TABLE \"ReadStatus\" ADD COLUMN IF NOT EXISTS \"newCol\" TEXT;"

# Then regenerate Prisma client
cd "$PROJECT_DIR/backend"
npx prisma generate
```

> **Do not use** `prisma migrate dev` — it requires an interactive terminal. Use raw SQL + `npx prisma generate` for schema changes, or `prisma db push --accept-data-loss` (the `--accept-data-loss` flag is needed because of the `session` table managed by connect-pg-simple — this is safe as long as you're not dropping columns).

---

## Fresh installation

The bundled `setup.sh` and `deploy.sh` automate most of this. The manual sequence is:

1. **Set up PostgreSQL:**
   ```bash
   DB_USER=rssreader DB_PASSWORD="$(openssl rand -hex 16)" \
   sudo -u postgres psql -c "CREATE USER \"$DB_USER\" WITH PASSWORD '$DB_PASSWORD' CREATEDB;"
   sudo -u postgres psql -c "CREATE DATABASE rssreader OWNER \"$DB_USER\";"
   ```

2. **Configure `backend/.env`** (see Environment Variables above). Set `DATABASE_URL` to use the user/password from step 1.

3. **Install dependencies:**
   ```bash
   (cd "$PROJECT_DIR/backend"  && npm install)
   (cd "$PROJECT_DIR/frontend" && npm install)
   ```

4. **Run Prisma migrations:**
   ```bash
   cd "$PROJECT_DIR/backend"
   npx prisma migrate deploy
   npx prisma generate
   ```

5. **Build and deploy backend:**
   ```bash
   cd "$PROJECT_DIR/backend"
   npm run build
   # write /etc/systemd/system/rss-reader.service (see above)
   sudo systemctl daemon-reload
   sudo systemctl enable rss-reader && sudo systemctl start rss-reader
   ```

6. **Build and deploy frontend:**
   ```bash
   cd "$PROJECT_DIR/frontend"
   npm run build
   sudo mkdir -p /var/www/html/rss-reader
   sudo cp -r build/. /var/www/html/rss-reader/
   sudo chown -R www-data:www-data /var/www/html/rss-reader
   ```

7. **Configure Apache** (add block from above to your vhost), then:
   ```bash
   sudo apachectl configtest && sudo systemctl reload apache2
   ```

8. **Configure Google Console** with the redirect URI above; add each `ALLOWED_EMAILS` entry as a Test User.

---

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Blank page in browser | Browser console for JS errors; check `index.html` references correct JS hash |
| API calls 404 | Verify `REACT_APP_API_URL=/rssreader` in `frontend/.env.production` and rebuild |
| OAuth redirect error | Callback URL in Google Console must exactly match `GOOGLE_CALLBACK_URL` in .env |
| OAuth login rejected | Email is not in `ALLOWED_EMAILS`, or the address isn't a Test User in Google Console |
| Backend won't start | `sudo journalctl -u rss-reader -n 50`; check .env is present and valid |
| Build permission error | `sudo chown -R "$USER:$USER" frontend/build` |
| Favicon missing | Ensure `public/index.html` uses `%PUBLIC_URL%/favicon.svg` not `/favicon.svg` |
| Session lost on restart | Normal if session table was dropped; sessions persist across restarts otherwise |
