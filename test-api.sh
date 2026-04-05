#!/bin/bash

echo "Testing if API returns thumbnails..."
echo ""

# Get a feed item ID
ITEM_ID=$(psql -U secorp -d rssreader -t -c "SELECT id FROM \"FeedItem\" WHERE thumbnail IS NOT NULL LIMIT 1;")

echo "Testing API endpoint: /api/feed-items"
echo ""

curl -s http://localhost:3003/api/feed-items?limit=3 | jq '.[0] | {id, title, thumbnail}'

echo ""
echo ""
echo "If you see a thumbnail URL above, the API is working correctly."
echo "If thumbnail is null, there's an issue with the backend."
