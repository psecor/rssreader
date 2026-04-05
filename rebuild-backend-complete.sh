#!/bin/bash

echo "==========================================="
echo "Complete Backend Rebuild (with Prisma)"
echo "==========================================="
echo ""

cd /home/secorp/src/rssreader/backend

echo "Step 1: Regenerating Prisma client..."
npx prisma generate

if [ $? -ne 0 ]; then
    echo "✗ Prisma generate failed"
    exit 1
fi
echo "✓ Prisma client regenerated"

echo ""
echo "Step 2: Rebuilding backend TypeScript..."
npm run build

if [ $? -ne 0 ]; then
    echo "✗ Build failed"
    exit 1
fi
echo "✓ Backend rebuilt"

echo ""
echo "Step 3: Restarting backend service..."
sudo systemctl restart rss-reader

echo ""
echo "Step 4: Waiting for service to start..."
sleep 3

echo ""
echo "Step 5: Checking service status..."
sudo systemctl status rss-reader --no-pager -n 10

echo ""
echo "Step 6: Testing API for thumbnails..."
echo ""
echo "Checking if feed items have thumbnail field in database..."
psql -U secorp -d rssreader -c "SELECT COUNT(*) as with_thumbnails FROM \"FeedItem\" WHERE thumbnail IS NOT NULL;"

echo ""
echo "==========================================="
echo "✓ Backend completely rebuilt!"
echo "==========================================="
echo ""
echo "Now test in your browser:"
echo "1. Open incognito: https://secorp.net:3444"
echo "2. Open dev tools (F12)"
echo "3. Go to Network tab"
echo "4. Reload page"
echo "5. Click on /api/feed-items request"
echo "6. Check if response has 'thumbnail' field"
