#!/bin/bash

echo "Fixing PostgreSQL authentication for RSS Reader..."
echo ""

# Set password for secorp user
echo "Setting password for PostgreSQL user 'secorp'..."
sudo -u postgres psql -c "ALTER USER secorp WITH PASSWORD 'REDACTED';"

if [ $? -eq 0 ]; then
    echo "✓ Password set successfully"
else
    echo "✗ Failed to set password"
    exit 1
fi

echo ""
echo "Testing connection with password..."
PGPASSWORD=REDACTED psql -U secorp -h localhost -d rssreader -c "SELECT 'Connection successful!' as status;"

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Database authentication fixed!"
    echo ""
    echo "You can now run the deployment script:"
    echo "  ./deploy.sh"
else
    echo ""
    echo "✗ Connection still failing"
    echo ""
    echo "Alternative: Use peer authentication (no password needed)"
    echo "Run this command to update .env:"
    echo "  sed -i 's|postgresql://secorp:REDACTED@localhost|postgresql://secorp@localhost|g' backend/.env"
fi
