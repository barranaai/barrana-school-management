#!/bin/bash

# 🚀 Hostinger Production Update Script
# This script updates the production server with latest code changes
# Run this ON THE HOSTINGER SERVER as the barrana user or root

set -e  # Exit on any error

echo "🚀 Starting production update for Barrana AI School Management..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Configuration
APP_DIR="/var/www/barrana/barrana-school"
BACKUP_DIR="/var/www/barrana/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Check if directory exists
if [ ! -d "$APP_DIR" ]; then
    print_error "Application directory not found: $APP_DIR"
    print_error "Please run the initial deployment script first (deploy-hostinger.sh)"
    exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Step 1: Create backup
print_step "1/8 Creating backup of current deployment..."
print_status "Backing up to: $BACKUP_DIR/backup_$TIMESTAMP"

# Backup important files
mkdir -p "$BACKUP_DIR/backup_$TIMESTAMP"
cp -r "$APP_DIR/backend/config.env" "$BACKUP_DIR/backup_$TIMESTAMP/" 2>/dev/null || print_warning "config.env not found"
cp -r "$APP_DIR/.env.production" "$BACKUP_DIR/backup_$TIMESTAMP/" 2>/dev/null || print_warning ".env.production not found"
cp -r "$APP_DIR/backend/uploads" "$BACKUP_DIR/backup_$TIMESTAMP/" 2>/dev/null || print_warning "uploads directory not found"

print_status "Backup completed!"

# Step 2: Stop backend
print_step "2/8 Stopping backend server..."
pm2 stop barrana-backend || print_warning "Backend was not running"

# Step 3: Pull latest code
print_step "3/8 Pulling latest code from repository..."
cd "$APP_DIR"
git stash  # Stash any local changes
git pull origin main
print_status "Code updated to latest version!"

# Step 4: Restore environment files
print_step "4/8 Restoring environment configuration..."
if [ -f "$BACKUP_DIR/backup_$TIMESTAMP/config.env" ]; then
    cp "$BACKUP_DIR/backup_$TIMESTAMP/config.env" "$APP_DIR/backend/config.env"
    print_status "Backend config restored"
fi

if [ -f "$BACKUP_DIR/backup_$TIMESTAMP/.env.production" ]; then
    cp "$BACKUP_DIR/backup_$TIMESTAMP/.env.production" "$APP_DIR/.env.production"
    print_status "Frontend config restored"
fi

# Step 5: Install backend dependencies
print_step "5/8 Installing backend dependencies..."
cd "$APP_DIR/backend"
npm install --production
print_status "Backend dependencies updated!"

# Step 6: Install frontend dependencies and build
print_step "6/8 Installing frontend dependencies..."
cd "$APP_DIR"
npm install
print_status "Frontend dependencies installed!"

print_step "7/8 Building frontend (this may take a few minutes)..."
npm run build
print_status "Frontend build completed!"

# Step 7: Restore uploads directory
print_step "8/8 Restoring uploads..."
if [ -d "$BACKUP_DIR/backup_$TIMESTAMP/uploads" ]; then
    rm -rf "$APP_DIR/backend/uploads"
    cp -r "$BACKUP_DIR/backup_$TIMESTAMP/uploads" "$APP_DIR/backend/uploads"
    print_status "Uploads directory restored"
fi

# Step 8: Restart services
print_status "Restarting services..."

# Restart backend
pm2 restart barrana-backend
print_status "Backend restarted!"

# Reload Nginx
if [ "$EUID" -eq 0 ]; then
    systemctl reload nginx
    print_status "Nginx reloaded!"
else
    print_warning "Skipping Nginx reload (requires root). Run: sudo systemctl reload nginx"
fi

# Clean up old backups (keep last 5)
print_status "Cleaning up old backups..."
cd "$BACKUP_DIR"
ls -t | tail -n +6 | xargs rm -rf 2>/dev/null || true

echo ""
echo "🎉 Production update completed successfully!"
echo ""
echo "📋 Deployment Info:"
echo "   Backup location: $BACKUP_DIR/backup_$TIMESTAMP"
echo "   Application directory: $APP_DIR"
echo ""
echo "🔍 Verification Commands:"
echo "   Check backend status: pm2 status"
echo "   View backend logs: pm2 logs barrana-backend"
echo "   Check Nginx: sudo systemctl status nginx"
echo ""
echo "🌐 Access your application:"
echo "   Frontend: http://191.101.233.56"
echo "   Backend API: http://191.101.233.56/api/health"
echo ""
echo "⚠️  If you encounter any issues, you can rollback:"
echo "   1. Stop backend: pm2 stop barrana-backend"
echo "   2. Restore from backup: cp -r $BACKUP_DIR/backup_$TIMESTAMP/* $APP_DIR/"
echo "   3. Restart backend: pm2 restart barrana-backend"
echo ""

