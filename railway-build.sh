#!/bin/bash

# Railway Build Script for Backend Only
set -e

echo "🚀 Building Barrana AI Backend for Railway..."

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

# Navigate to backend directory
cd backend

print_info "Installing backend dependencies..."
npm ci --only=production

print_info "Creating upload directories..."
mkdir -p uploads/audio uploads/media uploads/logos

print_status "Backend build completed successfully!"

# Go back to root
cd ..

print_info "Railway will now deploy your backend service."
print_info "Make sure to configure environment variables in Railway dashboard."
