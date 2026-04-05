#!/bin/bash

echo "Running database migrations..."
cd /home/secorp/src/rssreader/backend

echo ""
echo "Step 1: Running Prisma migrations..."
npx prisma migrate dev --name init

if [ $? -eq 0 ]; then
    echo "✓ Migrations completed successfully"
else
    echo "✗ Migrations failed"
    exit 1
fi

echo ""
echo "Step 2: Verifying tables were created..."
psql -U secorp -d rssreader -c "\dt"

echo ""
echo "Step 3: Restarting backend service..."
sudo systemctl restart rss-reader

echo ""
echo "Step 4: Checking service status..."
sleep 2
sudo systemctl status rss-reader --no-pager -n 10

echo ""
echo "✓ Done! Try logging in again at https://secorp.net:3444"
