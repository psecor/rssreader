# Architecture Changes for Apache Proxy Setup

## Overview

The RSS Reader has been configured to work with your existing Apache reverse proxy architecture, similar to your Job CRM application.

## Configuration Summary

### Port Allocation
- **Public Port**: 3444 (Apache HTTPS)
- **Backend Port**: 3003 (localhost only)
- **Database**: PostgreSQL on localhost:5432

### URLs
- **Public URL**: https://secorp.net:3444
- **OAuth Callback**: https://secorp.net:3444/auth/google/callback
- **Backend (internal)**: http://localhost:3003

### How It Works

```
User Browser (https://secorp.net:3444)
         ↓
    Apache (port 3444)
         ↓
    ├── Static Files (/var/www/html/rss-reader)  [Frontend]
    ├── /api/* → http://localhost:3003/api/*      [Backend Proxy]
    └── /auth/* → http://localhost:3003/auth/*    [Backend Proxy]
         ↓
    Node.js Backend (port 3003)
         ↓
    PostgreSQL (port 5432)
```

## Key Configuration Changes

### 1. Backend Environment (.env)
```env
GOOGLE_CALLBACK_URL="https://secorp.net:3444/auth/google/callback"
FRONTEND_URL="https://secorp.net:3444"
PORT=3003
NODE_ENV="production"
```

**Why**: OAuth requires the public-facing URL, not localhost. Google redirects to secorp.net.

### 2. Frontend API Client (src/services/api.ts)
```typescript
baseURL: process.env.REACT_APP_API_URL || ''  // Relative URLs
```

**Why**: Frontend and backend are on the same domain (secorp.net:3444) thanks to Apache proxy, so we use relative URLs like `/api/feeds`.

### 3. Login Page (src/pages/LoginPage.tsx)
```typescript
window.location.href = '/auth/google'  // Relative URL
```

**Why**: The OAuth flow starts from the same domain as the frontend.

### 4. Session Cookie (src/index.ts)
```typescript
cookie: {
  secure: true,              // HTTPS only
  sameSite: 'lax',          // Same domain, allow OAuth redirects
}
```

**Why**: Frontend and backend share the same domain via proxy, so 'lax' works. 'none' would be needed for cross-domain.

### 5. Apache Configuration (rss-reader-apache.conf)
- Listens on port 3444 with SSL
- Serves frontend static files
- Proxies `/api` and `/auth` to localhost:3003
- Handles React Router (SPA routing)

## Comparison with Localhost Setup

| Aspect | Localhost (Development) | Apache Proxy (Production) |
|--------|------------------------|---------------------------|
| Frontend URL | http://localhost:3000 | https://secorp.net:3444 |
| Backend URL | http://localhost:3001 | http://localhost:3003 (internal) |
| OAuth Callback | localhost:3001/auth/google/callback | secorp.net:3444/auth/google/callback |
| API Calls | Absolute (http://localhost:3001/api) | Relative (/api) |
| SSL | No | Yes (Apache handles it) |
| Cookie Settings | secure: false, sameSite: 'lax' | secure: true, sameSite: 'lax' |

## Google OAuth Configuration

In Google Cloud Console, you must configure:

**Authorized JavaScript origins:**
- https://secorp.net:3444

**Authorized redirect URIs:**
- https://secorp.net:3444/auth/google/callback

**Test Users:**
- secorp@gmail.com

## Files Changed

### Configuration Files
- `backend/.env` - Updated URLs and port
- `backend/src/index.ts` - Cookie settings
- `frontend/src/services/api.ts` - Use relative URLs
- `frontend/src/pages/LoginPage.tsx` - Use relative OAuth URL
- `frontend/package.json` - Removed proxy setting

### New Files
- `rss-reader-apache.conf` - Apache virtual host configuration
- `DEPLOYMENT.md` - Deployment instructions
- `ARCHITECTURE_CHANGES.md` - This file

### Updated Files
- `OAUTH_SETUP_INSTRUCTIONS.md` - Updated with secorp.net URLs

## Why This Architecture?

1. **Security**: SSL handled by Apache with Let's Encrypt certificates
2. **Consistency**: Same pattern as your other apps (Job CRM)
3. **Simplicity**: No CORS issues, same domain for frontend/backend
4. **OAuth**: Works correctly with Google's redirect requirements
5. **Production-ready**: Proper session handling and cookie security

## Next Steps

1. **Create PostgreSQL database** (see DEPLOYMENT.md step 1)
2. **Get Google OAuth credentials** (see OAUTH_SETUP_INSTRUCTIONS.md)
3. **Update backend/.env** with your credentials
4. **Follow DEPLOYMENT.md** for full deployment

## Troubleshooting

If OAuth doesn't work:
1. Check Google Console URLs match exactly: `https://secorp.net:3444`
2. Verify secorp@gmail.com is a test user
3. Check Apache is proxying correctly: `curl -I https://secorp.net:3444/auth/me`
4. Check backend logs: `sudo journalctl -u rss-reader -f`

If API calls fail:
1. Verify Apache proxy is working: `sudo apache2ctl configtest`
2. Check backend is running: `curl http://localhost:3003/health`
3. Check Apache error log: `sudo tail -f /var/log/apache2/rss-reader-error.log`
