#!/bin/bash

# Quick Service Status Checker for Barrana AI
# Run this on your Hostinger VPS

echo "======================================"
echo "🔍 BARRANA SERVER STATUS CHECK"
echo "======================================"
echo ""

echo "📊 PM2 Processes:"
pm2 list

echo ""
echo "🌐 Nginx Status:"
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx is RUNNING"
    systemctl status nginx --no-pager | head -3
else
    echo "❌ Nginx is NOT RUNNING"
fi

echo ""
echo "🗄️ MongoDB Status:"
if systemctl is-active --quiet mongod; then
    echo "✅ MongoDB is RUNNING"
    systemctl status mongod --no-pager | head -3
else
    echo "❌ MongoDB is NOT RUNNING"
fi

echo ""
echo "💾 Disk Usage:"
df -h / | tail -1

echo ""
echo "🧠 Memory Usage:"
free -h | grep Mem

echo ""
echo "🔥 Backend Health Check:"
HEALTH=$(curl -s http://localhost:5050/api/health 2>/dev/null || curl -s http://localhost:3001/api/health 2>/dev/null)
if [ ! -z "$HEALTH" ]; then
    echo "✅ Backend responding:"
    echo "$HEALTH" | grep -o '"status":"[^"]*"' || echo "$HEALTH"
else
    echo "❌ Backend not responding"
fi

echo ""
echo "🌍 Public Access Test:"
PUBLIC_HEALTH=$(curl -s http://191.101.233.56/api/health 2>/dev/null)
if [ ! -z "$PUBLIC_HEALTH" ]; then
    echo "✅ Public API accessible"
else
    echo "❌ Public API not accessible"
fi

echo ""
echo "📂 Project Location:"
if [ -d "/var/www/barrana/barrana-school" ]; then
    echo "✅ Found at: /var/www/barrana/barrana-school"
    cd /var/www/barrana/barrana-school
    echo "   Backend path: $(pwd)/backend"
    echo "   Frontend build: $(pwd)/build"
else
    echo "❌ Project not found at expected location"
fi

echo ""
echo "🔌 Listening Ports:"
netstat -tlnp | grep -E ':(80|443|5050|5051|27017|3001)' | head -10

echo ""
echo "======================================"
echo "Summary: All services $(systemctl is-active nginx mongod &>/dev/null && pm2 list | grep -q online && echo '✅ RUNNING' || echo '⚠️ CHECK NEEDED')"
echo "======================================"

