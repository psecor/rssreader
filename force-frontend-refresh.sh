#!/bin/bash

echo "==========================================="
echo "Force Frontend Refresh (Clear Cache)"
echo "==========================================="
echo ""

cd /home/secorp/src/rssreader/frontend

echo "Step 1: Rebuilding frontend..."
npm run build

if [ $? -ne 0 ]; then
    echo "✗ Frontend build failed"
    exit 1
fi

echo ""
echo "Step 2: Removing old frontend files..."
sudo rm -rf /var/www/html/rss-reader/*

echo ""
echo "Step 3: Deploying new frontend..."
sudo cp -r build/* /var/www/html/rss-reader/

echo ""
echo "Step 4: Setting permissions..."
sudo chown -R www-data:www-data /var/www/html/rss-reader

echo ""
echo "Step 5: Listing deployed files..."
ls -lh /var/www/html/rss-reader/static/css/

echo ""
echo "==========================================="
echo "✓ Frontend force-refreshed!"
echo "==========================================="
echo ""
echo "Now try in your browser:"
echo "1. Open https://secorp.net:3444 in incognito mode"
echo "2. Or hard refresh with Ctrl+Shift+R"
echo ""
echo "You should now see thumbnails!"
