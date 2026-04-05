#!/bin/bash

echo "Refreshing all RSS feeds to fetch thumbnails..."
echo ""

cd /home/secorp/src/rssreader/backend

# Compile the refresh script
npx ts-node src/scripts/refresh-feeds.ts

echo ""
echo "Done! Check https://secorp.net:3444 to see thumbnails on feed items."
