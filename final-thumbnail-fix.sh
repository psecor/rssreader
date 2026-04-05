#!/bin/bash

echo "==========================================="
echo "FINAL Thumbnail Fix - Parser Configuration"
echo "==========================================="
echo ""
echo "Root cause: RSS parser wasn't configured to extract media:content fields"
echo ""

cd /home/secorp/src/rssreader/backend

echo "Step 1: Rebuilding backend with parser config fix..."
npm run build

if [ $? -ne 0 ]; then
    echo "✗ Build failed"
    exit 1
fi
echo "✓ Backend rebuilt"

echo ""
echo "Step 2: Force stopping backend..."
sudo systemctl stop rss-reader
sudo pkill -f "node.*rss-reader" 2>/dev/null || true
sleep 2

echo ""
echo "Step 3: Starting backend with fixed parser..."
sudo systemctl start rss-reader
sleep 3

echo ""
echo "Step 4: Checking service status..."
sudo systemctl status rss-reader --no-pager -n 10

echo ""
echo "Step 5: Testing parser with actual feed..."
echo "Running test to verify media:content is now parsed..."
npx ts-node src/scripts/test-feed-parsing.ts 2>&1 | grep -A 2 "media:content" | head -10

echo ""
echo "Step 6: Refreshing all feeds to get thumbnails..."
npx ts-node src/scripts/refresh-feeds.ts

echo ""
echo "Step 7: Checking results..."
psql -U secorp -d rssreader -c "SELECT COUNT(*) as total, COUNT(thumbnail) as with_thumbnails FROM \"FeedItem\";"

echo ""
echo "==========================================="
echo "✓ COMPLETE!"
echo "==========================================="
echo ""
echo "Now check your browser:"
echo "1. Open incognito: https://secorp.net:3444"
echo "2. Hard refresh (Ctrl+Shift+R)"
echo "3. You should see car thumbnails!"
