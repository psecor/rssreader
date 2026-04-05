#!/bin/bash

echo "==========================================="
echo "Fixing Thumbnail Extraction"
echo "==========================================="
echo ""

cd /home/secorp/src/rssreader/backend

echo "Step 1: Rebuilding backend with fixed thumbnail extraction..."
npm run build

if [ $? -eq 0 ]; then
    echo "✓ Backend rebuilt"
else
    echo "✗ Build failed"
    exit 1
fi

echo ""
echo "Step 2: Restarting backend service..."
sudo systemctl restart rss-reader

echo ""
echo "Step 3: Waiting for service to start..."
sleep 3

echo ""
echo "Step 4: Refreshing all feeds to extract thumbnails..."
npx ts-node src/scripts/refresh-feeds.ts

echo ""
echo "Step 5: Checking results..."
psql -U secorp -d rssreader -c "SELECT COUNT(*) as total, COUNT(thumbnail) as with_thumbnails FROM \"FeedItem\";"

echo ""
echo "==========================================="
echo "✓ Done!"
echo "==========================================="
echo ""
echo "Refresh https://secorp.net:3444 to see thumbnails!"
