#!/bin/bash

echo "Checking authentication flow..."
echo ""

echo "1. Recent backend logs:"
sudo journalctl -u rss-reader -n 50 --no-pager | grep -E "(auth|OAuth|session|callback)" | tail -20

echo ""
echo "2. Checking if session table exists:"
psql -U secorp -d rssreader -c "SELECT COUNT(*) as session_count FROM session;" 2>&1

echo ""
echo "3. Testing /auth/me endpoint:"
curl -s http://localhost:3003/auth/me

echo ""
echo ""
echo "4. Checking Apache proxy headers:"
sudo tail -20 /var/log/apache2/rss-reader-access.log | grep auth

echo ""
echo "5. Backend service status:"
sudo systemctl status rss-reader --no-pager | head -15
