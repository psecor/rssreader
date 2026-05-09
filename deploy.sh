#!/bin/bash
#
# rssreader production deployment. Builds backend + frontend, installs the
# frontend bundle into Apache's document root, configures the apache vhost,
# and starts the backend as a systemd service.
#
# Required env (override defaults if needed):
#   PROJECT_DIR     Absolute path to the rssreader checkout (default: $(pwd))
#   SERVICE_USER    System user the backend runs as (default: $USER)
#   FRONTEND_URL    URL the deployed app is reachable at — used for the post-
#                   deploy curl check, e.g. https://example.com:3444
#   BACKEND_PORT    Local port the backend listens on (default: 3003)
#
# This script edits /var/www, /etc/apache2, /etc/systemd/system, and reloads
# system services — it requires sudo. Run interactively the first time.

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"
SERVICE_USER="${SERVICE_USER:-$USER}"
BACKEND_PORT="${BACKEND_PORT:-3003}"
FRONTEND_URL="${FRONTEND_URL:-}"

echo "==========================================="
echo "RSS Reader Deployment Script"
echo "==========================================="
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() { echo -e "${GREEN}✓${NC} $1"; }
print_error()  { echo -e "${RED}✗${NC} $1"; }
print_info()   { echo -e "${YELLOW}ℹ${NC} $1"; }

cd "$PROJECT_DIR"

if [ ! -f "backend/package.json" ]; then
    print_error "Not in the RSS Reader project directory ($PROJECT_DIR)"
    exit 1
fi

print_info "Deploying from: $PROJECT_DIR (service user: $SERVICE_USER)"
echo ""

echo "Step 1: Installing backend dependencies..."
cd backend
npm install
print_status "Backend dependencies installed"
echo ""

echo "Step 2: Running database migrations..."
npx prisma migrate deploy
print_status "Database migrations completed"

echo "Step 2b: Generating Prisma client..."
npx prisma generate
print_status "Prisma client generated"
echo ""

echo "Step 3: Building backend TypeScript..."
npm run build
print_status "Backend compiled successfully"
cd ..
echo ""

echo "Step 4: Installing frontend dependencies..."
cd frontend
npm install
print_status "Frontend dependencies installed"
echo ""

echo "Step 5: Building frontend (React production build)..."
npm run build
print_status "Frontend built successfully"
cd ..
echo ""

echo "Step 6: Deploying frontend to Apache..."
if [ ! -d "frontend/build" ]; then
    print_error "Frontend build directory not found"
    exit 1
fi

print_info "Creating /var/www/html/rss-reader directory..."
sudo mkdir -p /var/www/html/rss-reader

print_info "Copying frontend files to Apache document root..."
sudo cp -r frontend/build/. /var/www/html/rss-reader/

print_info "Setting permissions..."
sudo chown -R www-data:www-data /var/www/html/rss-reader

print_status "Frontend deployed to /var/www/html/rss-reader"
echo ""

echo "Step 7: Configuring Apache..."
if [ -f "/etc/apache2/sites-available/rss-reader-apache.conf" ]; then
    print_info "Apache config already exists — leaving as-is"
else
    print_info "Copying Apache configuration..."
    print_info "NOTE: rss-reader-apache.conf is a template — fill in YOUR_DOMAIN /"
    print_info "YOUR_PORT / YOUR_CERT_PATH / BACKEND_PORT before this works."
    sudo cp rss-reader-apache.conf /etc/apache2/sites-available/
    print_status "Apache config copied"
fi

print_info "Enabling Apache site and modules..."
sudo a2ensite rss-reader-apache.conf 2>/dev/null || print_info "Site already enabled"
sudo a2enmod ssl proxy proxy_http rewrite headers >/dev/null 2>&1 || true

print_info "Testing Apache configuration..."
sudo apache2ctl configtest
print_status "Apache configuration valid"

print_info "Reloading Apache..."
sudo systemctl reload apache2
print_status "Apache reloaded"
echo ""

echo "Step 8: Setting up systemd service..."
print_info "Creating systemd service file..."
sudo tee /etc/systemd/system/rss-reader.service > /dev/null <<EOF
[Unit]
Description=RSS Reader Backend
After=network.target postgresql.service

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${PROJECT_DIR}/backend
ExecStart=/usr/bin/node ${PROJECT_DIR}/backend/dist/index.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
print_status "Systemd service file created"

sudo systemctl daemon-reload
sudo systemctl enable rss-reader

if sudo systemctl is-active --quiet rss-reader; then
    print_info "Service is running, restarting..."
    sudo systemctl restart rss-reader
else
    print_info "Starting rss-reader service..."
    sudo systemctl start rss-reader
fi

sleep 2
if sudo systemctl is-active --quiet rss-reader; then
    print_status "RSS Reader service is running"
else
    print_error "RSS Reader service failed to start"
    print_info "Check logs with: sudo journalctl -u rss-reader -n 50"
    exit 1
fi
echo ""

echo "Step 9: Verifying deployment..."
sleep 2

print_info "Checking backend health endpoint..."
HEALTH_CHECK=$(curl -s "http://localhost:${BACKEND_PORT}/health" 2>/dev/null || echo "failed")
if [[ "$HEALTH_CHECK" == *"ok"* ]]; then
    print_status "Backend health check passed"
else
    print_error "Backend health check failed"
    print_info "Check backend logs with: sudo journalctl -u rss-reader -n 50"
fi

if [ -n "$FRONTEND_URL" ]; then
    print_info "Checking frontend at $FRONTEND_URL ..."
    FRONTEND_CHECK=$(curl -I -s "$FRONTEND_URL/" 2>/dev/null | head -1)
    if [[ "$FRONTEND_CHECK" == *"200"* ]]; then
        print_status "Frontend is accessible via Apache"
    else
        print_info "Frontend check returned: $FRONTEND_CHECK"
        print_info "You may need to check Apache logs"
    fi
else
    print_info "FRONTEND_URL not set — skipping frontend reachability check"
fi

echo ""
echo "==========================================="
echo "Deployment Complete!"
echo "==========================================="
echo ""
if [ -n "$FRONTEND_URL" ]; then
    echo "Your RSS Reader is now deployed at:"
    echo "  ${GREEN}${FRONTEND_URL}${NC}"
    echo ""
fi
echo "Useful commands:"
echo "  Backend logs:    sudo journalctl -u rss-reader -f"
echo "  Backend status:  sudo systemctl status rss-reader"
echo "  Restart backend: sudo systemctl restart rss-reader"
echo "  Apache logs:     sudo tail -f /var/log/apache2/rss-reader-error.log"
echo ""
print_info "Don't forget to:"
echo "  1. Verify each address in ALLOWED_EMAILS is added as a test user in Google Console"
echo "  2. Test the OAuth login at \$FRONTEND_URL"
echo ""
