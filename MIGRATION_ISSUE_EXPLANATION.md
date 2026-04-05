# Migration Drift Issue Explanation

## What Happened

When you ran the thumbnail migration with `npx prisma migrate dev --name add_thumbnail`, Prisma detected a "drift" - meaning the database schema didn't match what it expected from the migration history.

This caused Prisma to **reset the database** and re-run all migrations from scratch, which deleted your existing data (categories and feeds).

## Why It Happened

The issue occurred because:

1. The initial deployment used `npx prisma migrate deploy` (production mode)
2. But the thumbnail update used `npx prisma migrate dev` (development mode)
3. `migrate dev` is designed to reset the database when it detects inconsistencies
4. `migrate deploy` is for production and never resets data

## How to Avoid This in the Future

### For Production Databases (like secorp.net)

**Never use `migrate dev` on production!** Always use this workflow:

1. **Test locally first** (on a separate test database):
   ```bash
   # Edit schema.prisma
   npx prisma migrate dev --name your_change_name
   # This creates the migration file and tests it
   ```

2. **Deploy to production**:
   ```bash
   npx prisma migrate deploy
   # This applies migrations without resetting
   ```

### Safe Migration Script for Production

I've created `safe-migrate.sh` which uses `migrate deploy` instead:

```bash
#!/bin/bash
cd /home/secorp/src/rssreader/backend
npx prisma migrate deploy  # Safe for production
npx prisma generate
npm run build
sudo systemctl restart rss-reader
```

## Current State

Your database was reset and you had to re-add:
- Categories
- Feeds

The good news is:
- The schema is now correct with the thumbnail field
- Future migrations will work properly if we use `migrate deploy`

## Preventing Data Loss

For future schema changes, we should:

1. Always backup data before migrations:
   ```bash
   pg_dump -U secorp rssreader > backup.sql
   ```

2. Use `migrate deploy` in production (not `migrate dev`)

3. Test migrations on a copy of the database first

## Recovery

Since the data was just categories and feeds (not articles), it's easy to re-add. The feed items will be fetched fresh from the RSS sources.

To get all the articles with thumbnails now, just run:
```bash
./refresh-all-feeds.sh
```
