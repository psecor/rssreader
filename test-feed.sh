#!/bin/bash

echo "Testing RSS feed parsing for Bring a Trailer..."
echo ""

cd /home/secorp/src/rssreader/backend
npx ts-node src/scripts/test-feed-parsing.ts
