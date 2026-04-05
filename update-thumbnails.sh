#!/bin/bash

echo "==========================================="
echo "Adding Thumbnail Support to RSS Reader"
echo "==========================================="
echo ""

cd /home/secorp/src/rssreader/backend

echo "Step 1: Running Prisma migration to add thumbnail field..."
npx prisma migrate dev --name add_thumbnail

if [ $? -eq 0 ]; then
    echo "✓ Migration completed"
else
    echo "✗ Migration failed"
    exit 1
fi

echo ""
echo "Step 2: Generating Prisma client..."
npx prisma generate

echo ""
echo "Step 3: Rebuilding backend..."
npm run build

if [ $? -eq 0 ]; then
    echo "✓ Backend rebuilt"
else
    echo "✗ Build failed"
    exit 1
fi

echo ""
echo "Step 4: Rebuilding frontend..."
cd ../frontend
npm run build

if [ $? -eq 0 ]; then
    echo "✓ Frontend rebuilt"
else
    echo "✗ Build failed"
    exit 1
fi

echo ""
echo "Step 5: Deploying frontend..."
sudo cp -r build/* /var/www/html/rss-reader/
sudo chown -R www-data:www-data /var/www/html/rss-reader

echo ""
echo "Step 6: Restarting backend service..."
sudo systemctl restart rss-reader

echo ""
echo "Step 7: Waiting for service to start..."
sleep 3

echo ""
echo "Step 8: Checking service status..."
sudo systemctl status rss-reader --no-pager -n 10

echo ""
echo "==========================================="
echo "✓ Thumbnail support added!"
echo "==========================================="
echo ""
echo "Notes:"
echo "- Thumbnails will appear for new feed items"
echo "- Existing items won't have thumbnails yet"
echo "- You can manually refresh feeds to get thumbnails:"
echo "  POST https://secorp.net:3444/api/feeds/:id/refresh"
echo ""
echo "Refresh the page at: https://secorp.net:3444"
