#!/bin/bash

echo "==================================="
echo "RSS Reader Setup Script"
echo "==================================="
echo ""

# Check if PostgreSQL is running
echo "1. Checking PostgreSQL..."
if pg_isready > /dev/null 2>&1; then
    echo "   ✓ PostgreSQL is running"
else
    echo "   ✗ PostgreSQL is not running"
    echo "   Please start PostgreSQL first"
    exit 1
fi

# Create database and user
echo ""
echo "2. Setting up database..."
echo "   This requires sudo access. You may be prompted for your password."
echo ""

# Create user
sudo -u postgres psql -c "CREATE USER secorp WITH PASSWORD 'REDACTED' CREATEDB;" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "   ✓ Created PostgreSQL user 'secorp'"
else
    echo "   ℹ User 'secorp' may already exist (this is fine)"
fi

# Create database
sudo -u postgres psql -c "CREATE DATABASE rssreader OWNER secorp;" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "   ✓ Created database 'rssreader'"
else
    echo "   ℹ Database 'rssreader' may already exist (this is fine)"
fi

# Test connection
echo ""
echo "3. Testing database connection..."
PGPASSWORD=REDACTED psql -U secorp -h localhost -d rssreader -c "SELECT 1;" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✓ Database connection successful"
else
    echo "   ✗ Could not connect to database"
    echo "   Trying without password (peer authentication)..."
    psql -U secorp -d rssreader -c "SELECT 1;" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "   ✓ Database connection successful (peer auth)"
        # Update .env to remove password
        sed -i 's|postgresql://secorp:REDACTED@localhost|postgresql://secorp@localhost|g' backend/.env
    else
        echo "   ✗ Database connection failed"
        exit 1
    fi
fi

# Check if .env exists and has OAuth credentials
echo ""
echo "4. Checking Google OAuth configuration..."
if [ -f "backend/.env" ]; then
    if grep -q "REPLACE_WITH_YOUR_CLIENT_ID" backend/.env; then
        echo "   ⚠ OAuth credentials not configured yet"
        echo ""
        echo "   Please follow these steps:"
        echo "   1. Open: https://console.cloud.google.com/"
        echo "   2. Follow instructions in: OAUTH_SETUP_INSTRUCTIONS.md"
        echo "   3. Edit backend/.env and replace:"
        echo "      - GOOGLE_CLIENT_ID"
        echo "      - GOOGLE_CLIENT_SECRET"
        echo ""
        echo "   Then run: ./setup.sh again"
        exit 0
    else
        echo "   ✓ OAuth credentials configured"
    fi
else
    echo "   ✗ backend/.env not found"
    exit 1
fi

# Install backend dependencies
echo ""
echo "5. Installing backend dependencies..."
cd backend
if [ -d "node_modules" ]; then
    echo "   ℹ Dependencies already installed"
else
    npm install
    if [ $? -eq 0 ]; then
        echo "   ✓ Backend dependencies installed"
    else
        echo "   ✗ Failed to install backend dependencies"
        exit 1
    fi
fi

# Run Prisma migrations
echo ""
echo "6. Running database migrations..."
npx prisma migrate dev --name init
if [ $? -eq 0 ]; then
    echo "   ✓ Database migrations completed"
else
    echo "   ✗ Database migrations failed"
    exit 1
fi

# Generate Prisma client
echo ""
echo "7. Generating Prisma client..."
npx prisma generate
if [ $? -eq 0 ]; then
    echo "   ✓ Prisma client generated"
else
    echo "   ✗ Failed to generate Prisma client"
    exit 1
fi

cd ..

# Install frontend dependencies
echo ""
echo "8. Installing frontend dependencies..."
cd frontend
if [ -d "node_modules" ]; then
    echo "   ℹ Dependencies already installed"
else
    npm install
    if [ $? -eq 0 ]; then
        echo "   ✓ Frontend dependencies installed"
    else
        echo "   ✗ Failed to install frontend dependencies"
        exit 1
    fi
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
