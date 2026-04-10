#!/bin/bash

# Clean and Deploy Production Script for Hostinger
# This script will clean the server and deploy fresh code

set -e  # Exit on any error

SERVER_IP="191.101.233.56"
SERVER_USER="root"
SSH_KEY="/tmp/hostinger_key"
PROJECT_NAME="barrana-school"
REMOTE_PATH="/var/www/barrana"

echo "======================================"
echo "BARRANA SCHOOL - CLEAN DEPLOYMENT"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Step 1: Server Audit${NC}"
echo "Checking current server state..."

# Check if server is reachable
if ! ping -c 1 -W 2 $SERVER_IP > /dev/null 2>&1; then
    echo -e "${RED}ERROR: Server is not reachable at $SERVER_IP${NC}"
    echo "Please check:"
    echo "  1. Server is running in Hostinger control panel"
    echo "  2. IP address is correct"
    echo "  3. Firewall allows SSH (port 22)"
    exit 1
fi

echo -e "${GREEN}✓ Server is reachable${NC}"

# Connect and audit
echo ""
echo -e "${YELLOW}Step 2: Auditing Server${NC}"
ssh -i $SSH_KEY $SERVER_USER@$SERVER_IP << 'AUDIT_EOF'
echo "=== Current Processes ==="
ps aux | grep -E "node|pm2|mongo" | grep -v grep || echo "No Node/MongoDB processes found"

echo ""
echo "=== PM2 Processes ==="
pm2 list || echo "PM2 not installed or no processes"

echo ""
echo "=== Directory Structure ==="
ls -la /var/www/ 2>/dev/null || echo "/var/www/ not found"

echo ""
echo "=== MongoDB Status ==="
systemctl status mongod --no-pager || service mongod status || echo "MongoDB not running as service"

echo ""
echo "=== Nginx Status ==="
systemctl status nginx --no-pager || service nginx status || echo "Nginx not running"

echo ""
echo "=== Disk Usage ==="
df -h | grep -E "Filesystem|/dev/"

echo ""
echo "=== Memory Usage ==="
free -h
AUDIT_EOF

echo ""
read -p "Do you want to proceed with cleanup? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Cleanup cancelled."
    exit 0
fi

echo ""
echo -e "${YELLOW}Step 3: Backup Current Data${NC}"
ssh -i $SSH_KEY $SERVER_USER@$SERVER_IP << 'BACKUP_EOF'
BACKUP_DIR="/root/backups/backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p $BACKUP_DIR

echo "Creating backup at $BACKUP_DIR"

# Backup MongoDB
if command -v mongodump &> /dev/null; then
    echo "Backing up MongoDB..."
    mongodump --out=$BACKUP_DIR/mongodb --db=barrana_ai || echo "MongoDB backup failed"
fi

# Backup uploads directory
if [ -d "/var/www/barrana/barrana-school/backend/uploads" ]; then
    echo "Backing up uploads..."
    cp -r /var/www/barrana/barrana-school/backend/uploads $BACKUP_DIR/
fi

# Backup config files
if [ -f "/var/www/barrana/barrana-school/backend/config.env" ]; then
    echo "Backing up config..."
    cp /var/www/barrana/barrana-school/backend/config.env $BACKUP_DIR/
fi

echo "Backup completed: $BACKUP_DIR"
ls -lh $BACKUP_DIR
BACKUP_EOF

echo ""
echo -e "${YELLOW}Step 4: Stop All Services${NC}"
ssh -i $SSH_KEY $SERVER_USER@$SERVER_IP << 'STOP_EOF'
echo "Stopping PM2 processes..."
pm2 stop all || echo "No PM2 processes to stop"
pm2 delete all || echo "No PM2 processes to delete"
pm2 kill || echo "PM2 daemon stopped"

echo "Stopping any Node processes..."
pkill -f "node.*server.js" || echo "No node server.js processes"
pkill -f "node.*backend" || echo "No node backend processes"

echo "Checking remaining processes..."
ps aux | grep -E "node|pm2" | grep -v grep || echo "All Node processes stopped"
STOP_EOF

echo ""
echo -e "${YELLOW}Step 5: Clean Old Deployments${NC}"
ssh -i $SSH_KEY $SERVER_USER@$SERVER_IP << 'CLEAN_EOF'
echo "Cleaning old files..."

# Remove old project files (but keep backups)
if [ -d "/var/www/barrana/barrana-school" ]; then
    echo "Removing old barrana-school directory..."
    rm -rf /var/www/barrana/barrana-school
fi

# Clean up any duplicate installations
find /var/www/barrana -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || echo "Cleaned node_modules"

echo "Cleanup completed"
ls -la /var/www/barrana/
CLEAN_EOF

echo ""
echo -e "${GREEN}Server cleaned and ready for fresh deployment!${NC}"
echo ""
echo "Next steps:"
echo "  1. Run: ./scripts/deploy-fresh-backend.sh"
echo "  2. Run: ./scripts/deploy-fresh-frontend.sh"
echo "  3. Verify services are running correctly"

