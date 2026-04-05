#!/bin/bash

echo "==========================================="
echo "Safe Production Migration Script"
echo "==========================================="
echo ""
echo "This script uses 'migrate deploy' which is safe for production."
echo "It will NOT reset your database or delete data."
echo ""

cd /home/secorp/src/rssreader/backend

echo "Step 1: Backing up database..."
BACKUP_FILE="/home/secorp/backups/rssreader-$(date +%Y%m%d-%H%M%S).sql"
mkdir -p /home/secorp/backups
pg_dump -U secorp rssreader > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✓ Database backed up to: $BACKUP_FILE"
else
    echo "✗ Backup failed!"
    exit 1
fi

echo ""
echo "Step 2: Applying migrations (safe mode)..."
npx prisma migrate deploy

if [ $? -eq 0 ]; then
    echo "✓ Migrations applied successfully"
else
    echo "✗ Migrations failed"
    echo ""
    echo "To restore from backup:"
    echo "  psql -U secorp rssreader < $BACKUP_FILE"
    exit 1
fi

echo ""
echo "Step 3: Generating Prisma client..."
npx prisma generate

echo ""
echo "Step 4: Rebuilding backend..."
npm run build

if [ $? -eq 0 ]; then
    echo "✓ Backend rebuilt"
else
    echo "✗ Build failed"
    exit 1
fi

echo ""
echo "Step 5: Restarting backend service..."
sudo systemctl restart rss-reader

echo ""
echo "Step 6: Waiting for service..."
sleep 3

echo ""
echo "Step 7: Checking service status..."
sudo systemctl status rss-reader --no-pager -n 10

echo ""
echo "==========================================="
echo "✓ Migration completed safely!"
echo "==========================================="
echo ""
echo "Backup saved at: $BACKUP_FILE"
echo "Your data was preserved."
