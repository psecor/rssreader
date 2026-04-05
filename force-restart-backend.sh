#!/bin/bash

echo "==========================================="
echo "Force Restart Backend (Kill & Start)"
echo "==========================================="
echo ""

echo "Step 1: Stopping backend service..."
sudo systemctl stop rss-reader

echo ""
echo "Step 2: Killing any remaining node processes..."
sudo pkill -f "node.*rss-reader" || echo "No lingering processes found"

echo ""
echo "Step 3: Waiting..."
sleep 2

echo ""
echo "Step 4: Starting backend service with NEW code..."
sudo systemctl start rss-reader

echo ""
echo "Step 5: Waiting for service to start..."
sleep 3

echo ""
echo "Step 6: Checking service status..."
sudo systemctl status rss-reader --no-pager -n 15

echo ""
echo "Step 7: Checking recent logs..."
sudo journalctl -u rss-reader -n 20 --no-pager | tail -10

echo ""
echo "==========================================="
echo "✓ Backend force-restarted!"
echo "==========================================="
echo ""
echo "The scheduler will fetch new items with thumbnails on next run (every 15 min)."
echo ""
echo "Or run this to refresh NOW:"
echo "  cd /home/secorp/src/rssreader && ./refresh-all-feeds.sh"
