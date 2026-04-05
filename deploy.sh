#!/bin/bash

set -e  # Exit on any error

echo "==========================================="
echo "RSS Reader Deployment Script"
echo "==========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PROJECT_DIR="/home/secorp/src/rssreader"
cd "$PROJECT_DIR"

# Function to print colored messages
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "backend/package.json" ]; then
    print_error "Not in the RSS Reader project directory"
    exit 1
fi

print_info "Starting deployment from: $PROJECT_DIR"
echo ""

# ============================================
# Step 1: Backend Dependencies
# ============================================
echo "Step 1: Installing backend dependencies..."
cd backend

if [ -d "node_modules" ]; then
    print_info "Backend node_modules exists, running npm install to update..."
else
    print_info "Installing backend dependencies for the first time..."
fi

npm install
if [ $? -eq 0 ]; then
    print_status "Backend dependencies installed"
else
    print_error "Failed to install backend dependencies"
    exit 1
fi

echo ""

# ============================================
# Step 2: Database Migrations
# ============================================
echo "Step 2: Running database migrations..."

npx prisma migrate deploy
if [ $? -eq 0 ]; then
    print_status "Database migrations completed"
else
    print_error "Database migrations failed"
    exit 1
fi

echo ""

echo "Step 2b: Generating Prisma client..."
npx prisma generate
if [ $? -eq 0 ]; then
    print_status "Prisma client generated"
else
    print_error "Failed to generate Prisma client"
    exit 1
fi

echo ""

# ============================================
# Step 3: Build Backend TypeScript
# ============================================
echo "Step 3: Building backend TypeScript..."
npm run build
if [ $? -eq 0 ]; then
    print_status "Backend compiled successfully"
else
    print_error "Backend compilation failed"
    exit 1
fi

cd ..
echo ""

# ============================================
# Step 4: Frontend Dependencies
# ============================================
echo "Step 4: Installing frontend dependencies..."
cd frontend

if [ -d "node_modules" ]; then
    print_info "Frontend node_modules exists, running npm install to update..."
else
    print_info "Installing frontend dependencies for the first time..."
fi

npm install
if [ $? -eq 0 ]; then
    print_status "Frontend dependencies installed"
else
    print_error "Failed to install frontend dependencies"
    exit 1
fi

echo ""

# ============================================
# Step 5: Build Frontend
# ============================================
echo "Step 5: Building frontend (React production build)..."
npm run build
if [ $? -eq 0 ]; then
    print_status "Frontend built successfully"
else
    print_error "Frontend build failed"
    exit 1
fi

cd ..
echo ""

# ============================================
# Step 6: Deploy Frontend to Apache
# ============================================
echo "Step 6: Deploying frontend to Apache..."

# Check if build directory exists
if [ ! -d "frontend/build" ]; then
    print_error "Frontend build directory not found"
    exit 1
fi

# Create Apache directory if it doesn't exist
print_info "Creating /var/www/html/rss-reader directory..."
sudo mkdir -p /var/www/html/rss-reader

# Copy built files
print_info "Copying frontend files to Apache document root..."
sudo cp -r frontend/build/* /var/www/html/rss-reader/

# Set proper permissions
print_info "Setting permissions..."
sudo chown -R www-data:www-data /var/www/html/rss-reader

print_status "Frontend deployed to /var/www/html/rss-reader"
echo ""

# ============================================
# Step 7: Configure Apache
# ============================================
echo "Step 7: Configuring Apache..."

# Check if Apache config already exists
if [ -f "/etc/apache2/sites-available/rss-reader-apache.conf" ]; then
    print_info "Apache config already exists"
else
    print_info "Copying Apache configuration..."
    sudo cp rss-reader-apache.conf /etc/apache2/sites-available/
    print_status "Apache config copied"
fi

# Enable the site
print_info "Enabling Apache site..."
sudo a2ensite rss-reader-apache.conf 2>/dev/null || print_info "Site already enabled"

# Enable required modules
print_info "Enabling Apache modules..."
sudo a2enmod ssl 2>/dev/null || print_info "ssl already enabled"
sudo a2enmod proxy 2>/dev/null || print_info "proxy already enabled"
sudo a2enmod proxy_http 2>/dev/null || print_info "proxy_http already enabled"
sudo a2enmod rewrite 2>/dev/null || print_info "rewrite already enabled"
sudo a2enmod headers 2>/dev/null || print_info "headers already enabled"

# Test Apache config
print_info "Testing Apache configuration..."
sudo apache2ctl configtest
if [ $? -eq 0 ]; then
    print_status "Apache configuration valid"
else
    print_error "Apache configuration test failed"
    exit 1
fi

# Reload Apache
print_info "Reloading Apache..."
sudo systemctl reload apache2
if [ $? -eq 0 ]; then
    print_status "Apache reloaded successfully"
else
    print_error "Failed to reload Apache"
    exit 1
fi

echo ""

# ============================================
# Step 8: Set Up Systemd Service
# ============================================
echo "Step 8: Setting up systemd service..."

# Create systemd service file
print_info "Creating systemd service file..."
sudo tee /etc/systemd/system/rss-reader.service > /dev/null <<EOF
[Unit]
Description=RSS Reader Backend
After=network.target postgresql.service

[Service]
Type=simple
User=secorp
WorkingDirectory=/home/secorp/src/rssreader/backend
ExecStart=/usr/bin/node /home/secorp/src/rssreader/backend/dist/index.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

print_status "Systemd service file created"

# Reload systemd
print_info "Reloading systemd daemon..."
sudo systemctl daemon-reload

# Enable service
print_info "Enabling rss-reader service..."
sudo systemctl enable rss-reader

# Check if service is already running
if sudo systemctl is-active --quiet rss-reader; then
    print_info "Service is running, restarting..."
    sudo systemctl restart rss-reader
else
    print_info "Starting rss-reader service..."
    sudo systemctl start rss-reader
fi

# Wait a moment for service to start
sleep 2

# Check service status
if sudo systemctl is-active --quiet rss-reader; then
    print_status "RSS Reader service is running"
else
    print_error "RSS Reader service failed to start"
    print_info "Check logs with: sudo journalctl -u rss-reader -n 50"
    exit 1
fi

echo ""

# ============================================
# Step 9: Verify Deployment
# ============================================
echo "Step 9: Verifying deployment..."
echo ""

# Check backend health
print_info "Checking backend health endpoint..."
sleep 2
HEALTH_CHECK=$(curl -s http://localhost:3003/health 2>/dev/null || echo "failed")
if [[ "$HEALTH_CHECK" == *"ok"* ]]; then
    print_status "Backend health check passed"
else
    print_error "Backend health check failed"
    print_info "Check backend logs with: sudo journalctl -u rss-reader -n 50"
fi

# Check if Apache is serving the frontend
print_info "Checking Apache frontend..."
FRONTEND_CHECK=$(curl -I -s https://secorp.net:3444/ 2>/dev/null | head -1)
if [[ "$FRONTEND_CHECK" == *"200"* ]]; then
    print_status "Frontend is accessible via Apache"
else
    print_info "Frontend check returned: $FRONTEND_CHECK"
    print_info "You may need to check Apache logs"
fi

echo ""
echo "==========================================="
echo "Deployment Complete!"
echo "==========================================="
echo ""
echo "Your RSS Reader is now deployed at:"
echo "  ${GREEN}https://secorp.net:3444${NC}"
echo ""
echo "Useful commands:"
echo "  Backend logs:  sudo journalctl -u rss-reader -f"
echo "  Backend status: sudo systemctl status rss-reader"
echo "  Restart backend: sudo systemctl restart rss-reader"
echo "  Apache logs:   sudo tail -f /var/log/apache2/rss-reader-error.log"
echo ""
print_info "Don't forget to:"
echo "  1. Verify secorp@gmail.com is added as a test user in Google Console"
echo "  2. Test the OAuth login at https://secorp.net:3444"
echo ""
