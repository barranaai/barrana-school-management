#!/bin/bash

# 🚀 Local to Hostinger Deployment Script
# Run this script FROM YOUR LOCAL MACHINE to push code and deploy to Hostinger
# This script will:
# 1. Commit and push your changes to GitHub
# 2. SSH into Hostinger and run the update script

set -e  # Exit on any error

echo "🚀 Deploying to Hostinger Production Server..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

# Configuration
SERVER_IP="191.101.233.56"
SERVER_USER="root"
APP_DIR="/var/www/barrana/barrana-school"

# Step 1: Check for uncommitted changes
print_step "1/5 Checking for uncommitted changes..."
if ! git diff-index --quiet HEAD --; then
    print_warning "You have uncommitted changes"
    read -p "Do you want to commit them now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter commit message: " commit_msg
        git add .
        git commit -m "$commit_msg"
        print_status "Changes committed!"
    else
        print_error "Please commit your changes before deploying"
        exit 1
    fi
fi

# Step 2: Push to GitHub
print_step "2/5 Pushing to GitHub..."
git push origin main
print_status "Code pushed to GitHub!"

# Step 3: SSH and pull changes
print_step "3/5 Connecting to Hostinger server..."
ssh ${SERVER_USER}@${SERVER_IP} << 'ENDSSH'
echo "📥 Connected to Hostinger server!"

# Navigate to app directory
cd /var/www/barrana/barrana-school

# Make update script executable
chmod +x scripts/update-production.sh

# Run update script
bash scripts/update-production.sh

echo "✅ Server update completed!"
ENDSSH

print_status "Deployment completed!"

# Step 4: Verification
print_step "4/5 Verifying deployment..."
sleep 5  # Wait for services to fully restart

echo "Testing backend health..."
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://${SERVER_IP}/api/health || echo "000")

if [ "$HEALTH_CHECK" == "200" ]; then
    print_status "✅ Backend is healthy!"
else
    print_warning "⚠️  Backend health check returned: $HEALTH_CHECK"
    print_warning "Please check the logs on the server"
fi

# Step 5: Summary
print_step "5/5 Deployment Summary"
echo ""
echo "🎉 Deployment process completed!"
echo ""
echo "📋 Deployed to:"
echo "   Server: ${SERVER_IP}"
echo "   Frontend: http://${SERVER_IP}"
echo "   Backend API: http://${SERVER_IP}/api"
echo ""
echo "🔍 Next steps:"
echo "   1. Visit http://${SERVER_IP} to verify the frontend"
echo "   2. Test login with admin credentials"
echo "   3. Check that all features work correctly"
echo ""
echo "📊 To check logs on server:"
echo "   ssh ${SERVER_USER}@${SERVER_IP}"
echo "   pm2 logs barrana-backend"
echo ""

