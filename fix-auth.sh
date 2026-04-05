#!/bin/bash

echo "Fixing authentication issue (adding trust proxy support)..."
echo ""

cd /home/secorp/src/rssreader/backend

echo "Step 1: Rebuilding backend with proxy trust enabled..."
npm run build

if [ $? -eq 0 ]; then
    echo "✓ Backend rebuilt successfully"
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
echo "Step 4: Checking service status..."
sudo systemctl status rss-reader --no-pager -n 15

echo ""
echo "Step 5: Testing health endpoint..."
curl -s http://localhost:3003/health

echo ""
echo ""
echo "✓ Done! The trust proxy setting has been enabled."
echo ""
echo "This allows the backend to properly handle HTTPS cookies behind Apache."
echo ""
echo "Try logging in again at: https://secorp.net:3444"
