#!/bin/bash

# Production iOS Build Script for Barrana Parent App
# Creates a standalone .ipa file for TestFlight/App Store distribution

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}🍎 ======================================${NC}"
echo -e "${BLUE}   Barrana Parent App - iOS Build${NC}"
echo -e "${BLUE}   Production Distribution Build${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${RED}❌ Error: iOS builds require macOS${NC}"
    exit 1
fi

# Check for EAS CLI
if ! command -v eas &> /dev/null; then
    echo -e "${YELLOW}⚠️  EAS CLI not found. Installing...${NC}"
    npm install -g eas-cli
    echo -e "${GREEN}✅ EAS CLI installed${NC}"
fi

# Check if logged in
echo -e "${BLUE}🔐 Checking Expo login...${NC}"
if ! eas whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Expo${NC}"
    echo "Please login to your Expo account:"
    eas login
fi

EXPO_USER=$(eas whoami 2>/dev/null || echo "Not logged in")
echo -e "${GREEN}✅ Logged in as: ${EXPO_USER}${NC}"
echo ""

# Show build options
echo -e "${BLUE}📱 Select build profile:${NC}"
echo ""
echo "  1) ${GREEN}Production${NC}  - For App Store submission"
echo "  2) ${YELLOW}Preview${NC}     - For TestFlight internal testing"
echo "  3) ${BLUE}Development${NC} - For development/debugging"
echo ""
read -p "Enter choice (1-3): " choice

case $choice in
    1)
        PROFILE="production"
        echo -e "${GREEN}✅ Building for App Store (Production)${NC}"
        ;;
    2)
        PROFILE="preview"
        echo -e "${YELLOW}✅ Building for TestFlight (Preview)${NC}"
        ;;
    3)
        PROFILE="development"
        echo -e "${BLUE}✅ Building for Development${NC}"
        ;;
    *)
        echo -e "${RED}❌ Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${BLUE}🚀 Starting build process...${NC}"
echo -e "${YELLOW}⏱️  This will take 15-20 minutes${NC}"
echo ""

# Start build
eas build --platform ios --profile $PROFILE

echo ""
echo -e "${GREEN}✅ ======================================${NC}"
echo -e "${GREEN}   Build Complete!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo -e "${BLUE}📦 Next steps:${NC}"
echo ""

if [ "$PROFILE" = "production" ]; then
    echo "1. Download the .ipa file from the build link"
    echo "2. Submit to App Store Connect:"
    echo -e "   ${BLUE}eas submit --platform ios --latest${NC}"
    echo "3. Or upload manually via Transporter app"
elif [ "$PROFILE" = "preview" ]; then
    echo "1. Download the .ipa file from the build link"
    echo "2. Upload to TestFlight for internal testing"
    echo "3. Or run: ${BLUE}eas submit --platform ios --latest${NC}"
else
    echo "1. Download the .ipa file from the build link"
    echo "2. Install on your registered test device"
    echo "3. Test all features thoroughly"
fi

echo ""
echo "📋 View build status: ${BLUE}eas build:list${NC}"
echo "📥 Download build:    ${BLUE}eas build:download --platform ios${NC}"
echo ""

