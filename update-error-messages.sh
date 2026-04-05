#!/bin/bash

echo "Updating feed validation error messages..."
cd /home/secorp/src/rssreader/backend

npm run build
sudo systemctl restart rss-reader
sleep 2

echo "✓ Done! Now when you try to add a feed, you'll see the actual error."
