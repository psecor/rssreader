#!/bin/bash
#
# rssreader local setup. Creates a PostgreSQL role + database, runs Prisma
# migrations, and installs deps for both halves.
#
# Required env (no defaults — fail fast so prod doesn't end up with a
# well-known password):
#   DB_USER       PostgreSQL role to create/own the rssreader database
#   DB_PASSWORD   Password for that role
#   DB_NAME       Database name (default: rssreader)
#
# Example:
#   DB_USER=rssreader DB_PASSWORD="$(openssl rand -hex 16)" ./setup.sh

set -euo pipefail

: "${DB_USER:?DB_USER must be set (PostgreSQL role to create/own the rssreader database)}"
: "${DB_PASSWORD:?DB_PASSWORD must be set}"
DB_NAME="${DB_NAME:-rssreader}"

echo "==================================="
echo "RSS Reader Setup Script"
echo "==================================="
echo ""

echo "1. Checking PostgreSQL..."
if pg_isready > /dev/null 2>&1; then
    echo "   ✓ PostgreSQL is running"
else
    echo "   ✗ PostgreSQL is not running"
    echo "   Please start PostgreSQL first"
    exit 1
fi

echo ""
echo "2. Setting up database..."
echo "   This requires sudo access. You may be prompted for your password."
echo ""

if sudo -u postgres psql -c "CREATE USER \"${DB_USER}\" WITH PASSWORD '${DB_PASSWORD}' CREATEDB;" 2>/dev/null; then
    echo "   ✓ Created PostgreSQL user '${DB_USER}'"
else
    echo "   ℹ User '${DB_USER}' may already exist (this is fine)"
fi

if sudo -u postgres psql -c "CREATE DATABASE \"${DB_NAME}\" OWNER \"${DB_USER}\";" 2>/dev/null; then
    echo "   ✓ Created database '${DB_NAME}'"
else
    echo "   ℹ Database '${DB_NAME}' may already exist (this is fine)"
fi

echo ""
echo "3. Testing database connection..."
if PGPASSWORD="${DB_PASSWORD}" psql -U "${DB_USER}" -h localhost -d "${DB_NAME}" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "   ✓ Database connection successful"
else
    echo "   ✗ Could not connect to database"
    exit 1
fi

echo ""
echo "4. Checking backend/.env..."
if [ -f "backend/.env" ]; then
    if grep -q "your-google-client-id" backend/.env; then
        echo "   ⚠ Google OAuth credentials not configured yet."
        echo "   Edit backend/.env and fill in GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,"
        echo "   GOOGLE_CALLBACK_URL, ALLOWED_EMAILS, then re-run this script."
        exit 0
    fi
    echo "   ✓ backend/.env present"
else
    echo "   ✗ backend/.env not found — copy backend/.env.example and fill it in"
    exit 1
fi

echo ""
echo "5. Installing backend dependencies..."
cd backend
if [ -d "node_modules" ]; then
    echo "   ℹ Dependencies already installed"
else
    npm install
    echo "   ✓ Backend dependencies installed"
fi

echo ""
echo "6. Running database migrations..."
npx prisma migrate dev --name init
echo "   ✓ Database migrations completed"

echo ""
echo "7. Generating Prisma client..."
npx prisma generate
echo "   ✓ Prisma client generated"

cd ..

echo ""
echo "8. Installing frontend dependencies..."
cd frontend
if [ -d "node_modules" ]; then
    echo "   ℹ Dependencies already installed"
else
    npm install
    echo "   ✓ Frontend dependencies installed"
fi
cd ..

echo ""
echo "==================================="
echo "✓ Setup completed successfully!"
echo "==================================="
echo ""
echo "To start the application:"
echo ""
echo "Terminal 1 (Backend):"
echo "  cd backend && npm run dev"
echo ""
echo "Terminal 2 (Frontend):"
echo "  cd frontend && npm start"
echo ""
echo "Then open: http://localhost:3000"
echo ""
