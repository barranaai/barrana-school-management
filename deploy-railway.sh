#!/bin/bash

# Railway Deployment Script for Barrana AI School Management System
set -e

echo "🌊 Deploying Barrana AI School Management System to Railway..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    print_error "Railway CLI is not installed"
    echo "Install it with: npm i -g @railway/cli"
    exit 1
fi

print_status "Railway CLI is installed"

# Check if we're logged in
if ! railway whoami &> /dev/null; then
    print_warning "Not logged in to Railway"
    echo "Please run: railway login"
    exit 1
fi

print_status "Logged in to Railway"

# Check if project is initialized
if [ ! -f "railway.json" ]; then
    print_info "Initializing Railway project..."
    railway init
    print_status "Railway project initialized"
else
    print_status "Railway project already initialized"
fi

# Build the frontend
print_info "Building frontend for production..."
npm run build:production
print_status "Frontend built successfully"

# Deploy to Railway
print_info "Deploying to Railway..."
railway up

print_status "Deployment completed!"

# Get the deployment URL
print_info "Getting deployment URL..."
DEPLOYMENT_URL=$(railway domain 2>/dev/null || echo "Check Railway dashboard")

if [ -n "$DEPLOYMENT_URL" ] && [ "$DEPLOYMENT_URL" != "Check Railway dashboard" ]; then
    echo ""
    print_status "Your application is live at:"
    echo -e "${BLUE}🌐 $DEPLOYMENT_URL${NC}"
    echo ""
    print_info "Next steps:"
    echo "1. Add MongoDB database: railway add (choose MongoDB)"
    echo "2. Configure environment variables in Railway dashboard:"
    echo "   - JWT_SECRET"
    echo "   - OPENAI_API_KEY"
    echo "   - SMTP_HOST"
    echo "   - SMTP_PORT"
    echo "   - SMTP_USER"
    echo "   - SMTP_PASS"
    echo "3. Test your application"
    echo ""
    print_info "Railway commands:"
    echo "  View logs: railway logs"
    echo "  Open dashboard: railway open"
    echo "  Check status: railway status"
    echo ""
    print_info "Test your deployment:"
    echo "  Health check: $DEPLOYMENT_URL/api/health"
    echo "  Frontend: $DEPLOYMENT_URL"
else
    print_warning "Could not determine deployment URL"
    echo "Check Railway dashboard for your deployment URL"
    echo "Run: railway open"
fi

print_status "Railway deployment script completed!"
