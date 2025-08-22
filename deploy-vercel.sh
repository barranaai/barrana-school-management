#!/bin/bash

# Vercel Deployment Script for Barrana AI School Management System
set -e

echo "🚀 Deploying Barrana AI School Management System to Vercel..."

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

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    print_error "Vercel CLI is not installed"
    echo "Install it with: npm i -g vercel"
    exit 1
fi

print_status "Vercel CLI is installed"

# Check if we're logged in
if ! vercel whoami &> /dev/null; then
    print_warning "Not logged in to Vercel"
    echo "Please run: vercel login"
    exit 1
fi

print_status "Logged in to Vercel"

# Build the frontend
print_info "Building frontend for production..."
npm run build:production
print_status "Frontend built successfully"

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    print_warning "No .env.local file found"
    echo "Creating template .env.local file..."
    
    cat > .env.local << EOF
# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/barrana_school?retryWrites=true&w=majority

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# OpenAI
OPENAI_API_KEY=your-openai-api-key

# Email (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Frontend URL (will be updated after deployment)
FRONTEND_URL=https://your-app.vercel.app

# Environment
NODE_ENV=production
EOF
    
    print_warning "Please update .env.local with your actual values before deploying"
    echo "Then run this script again"
    exit 1
fi

print_status "Environment file found"

# Deploy to Vercel
print_info "Deploying to Vercel..."
vercel --prod

print_status "Deployment completed!"

# Get the deployment URL
DEPLOYMENT_URL=$(vercel ls | grep "barrana-school-management" | head -1 | awk '{print $2}')

if [ -n "$DEPLOYMENT_URL" ]; then
    echo ""
    print_status "Your application is live at:"
    echo -e "${BLUE}🌐 $DEPLOYMENT_URL${NC}"
    echo ""
    print_info "Next steps:"
    echo "1. Update FRONTEND_URL in .env.local to: $DEPLOYMENT_URL"
    echo "2. Configure environment variables in Vercel dashboard"
    echo "3. Test your application"
    echo ""
    print_info "Environment variables to configure in Vercel:"
    echo "  MONGODB_URI"
    echo "  JWT_SECRET"
    echo "  OPENAI_API_KEY"
    echo "  SMTP_HOST"
    echo "  SMTP_PORT"
    echo "  SMTP_USER"
    echo "  SMTP_PASS"
    echo "  FRONTEND_URL"
    echo "  NODE_ENV"
    echo ""
    print_info "Test your deployment:"
    echo "  Health check: $DEPLOYMENT_URL/api/health"
    echo "  Frontend: $DEPLOYMENT_URL"
else
    print_warning "Could not determine deployment URL"
    echo "Check Vercel dashboard for your deployment URL"
fi

print_status "Vercel deployment script completed!"
