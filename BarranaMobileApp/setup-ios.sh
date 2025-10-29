#!/bin/bash

# iOS Setup Script for Barrana Parent App
# This script automates iOS app setup

set -e  # Exit on error

echo "🍎 =================================="
echo "   iOS App Setup for Barrana"
echo "===================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${RED}❌ Error: iOS development requires macOS${NC}"
    exit 1
fi

echo -e "${BLUE}📋 Step 1: Checking prerequisites...${NC}"

# Check for Xcode Command Line Tools
if ! xcode-select -p &> /dev/null; then
    echo -e "${YELLOW}⚠️  Xcode Command Line Tools not found${NC}"
    echo "Installing Xcode Command Line Tools..."
    xcode-select --install
    echo "Please complete the installation and run this script again"
    exit 0
else
    echo -e "${GREEN}✅ Xcode Command Line Tools: $(xcode-select -p)${NC}"
fi

# Check for CocoaPods
if ! command -v pod &> /dev/null; then
    echo -e "${YELLOW}⚠️  CocoaPods not found${NC}"
    echo "Installing CocoaPods..."
    sudo gem install cocoapods
    echo -e "${GREEN}✅ CocoaPods installed${NC}"
else
    echo -e "${GREEN}✅ CocoaPods: $(pod --version)${NC}"
fi

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js first${NC}"
    exit 1
else
    echo -e "${GREEN}✅ Node.js: $(node --version)${NC}"
fi

echo ""
echo -e "${BLUE}📦 Step 2: Installing npm dependencies...${NC}"
npm install

echo ""
echo -e "${BLUE}🔨 Step 3: Generating iOS native code...${NC}"
npx expo prebuild --platform ios --clean

echo ""
echo -e "${BLUE}📱 Step 4: Installing iOS dependencies (CocoaPods)...${NC}"
cd ios
pod install
cd ..

echo ""
echo -e "${GREEN}✅ =================================="
echo "   iOS Setup Complete!"
echo "====================================${NC}"
echo ""
echo "🚀 Next steps:"
echo ""
echo "1. Run on iOS Simulator:"
echo -e "   ${BLUE}npx expo run:ios${NC}"
echo ""
echo "2. Run on specific simulator:"
echo -e "   ${BLUE}npx expo run:ios --simulator=\"iPhone 15 Pro\"${NC}"
echo ""
echo "3. Run on connected iPhone:"
echo -e "   ${BLUE}npx expo run:ios --device${NC}"
echo ""
echo "4. List available simulators:"
echo -e "   ${BLUE}xcrun simctl list devices${NC}"
echo ""
echo "📝 For more information, see: IOS_APP_SETUP_GUIDE.md"
echo ""

