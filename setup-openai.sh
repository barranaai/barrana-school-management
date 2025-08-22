#!/bin/bash

# OpenAI API Key Setup Script for Barrana.ai School Management System
# This script helps configure OpenAI API keys for both web and mobile applications

echo "🔑 OpenAI API Key Configuration Script"
echo "======================================"
echo ""

# Check if API key is provided as argument
if [ -z "$1" ]; then
    echo "❌ Error: Please provide your OpenAI API key as an argument"
    echo "Usage: ./setup-openai.sh YOUR_API_KEY"
    echo ""
    echo "Example: ./setup-openai.sh sk-your-actual-api-key-here"
    exit 1
fi

API_KEY=$1

# Validate API key format
if [[ ! $API_KEY =~ ^sk-[a-zA-Z0-9]{32,}$ ]]; then
    echo "❌ Error: Invalid API key format"
    echo "OpenAI API keys should start with 'sk-' followed by alphanumeric characters"
    exit 1
fi

echo "✅ Valid API key format detected"
echo ""

# Create .env file for web application
echo "🌐 Setting up Web Application..."
if [ ! -f .env ]; then
    cat > .env << EOF
# Barrana.ai School Management System - Environment Configuration

# OpenAI Configuration
REACT_APP_OPENAI_API_KEY=$API_KEY

# Backend API Configuration
REACT_APP_API_URL=http://localhost:5050

# Development Configuration
NODE_ENV=development
PORT=3000
EOF
    echo "✅ Created .env file for web application"
else
    # Update existing .env file
    if grep -q "REACT_APP_OPENAI_API_KEY" .env; then
        sed -i '' "s/REACT_APP_OPENAI_API_KEY=.*/REACT_APP_OPENAI_API_KEY=$API_KEY/" .env
        echo "✅ Updated existing .env file for web application"
    else
        echo "REACT_APP_OPENAI_API_KEY=$API_KEY" >> .env
        echo "✅ Added OpenAI API key to existing .env file"
    fi
fi

# Create .env file for mobile application
echo ""
echo "📱 Setting up Mobile Application..."
if [ ! -f BarranaMobileApp/.env ]; then
    cat > BarranaMobileApp/.env << EOF
# Barrana Mobile App - Environment Configuration

# OpenAI Configuration
EXPO_PUBLIC_OPENAI_API_KEY=$API_KEY

# Backend API Configuration
EXPO_PUBLIC_API_URL=http://localhost:5050

# Development Configuration
NODE_ENV=development
EOF
    echo "✅ Created .env file for mobile application"
else
    # Update existing .env file
    if grep -q "EXPO_PUBLIC_OPENAI_API_KEY" BarranaMobileApp/.env; then
        sed -i '' "s/EXPO_PUBLIC_OPENAI_API_KEY=.*/EXPO_PUBLIC_OPENAI_API_KEY=$API_KEY/" BarranaMobileApp/.env
        echo "✅ Updated existing .env file for mobile application"
    else
        echo "EXPO_PUBLIC_OPENAI_API_KEY=$API_KEY" >> BarranaMobileApp/.env
        echo "✅ Added OpenAI API key to existing .env file"
    fi
fi

# Create .env file for backend (optional)
echo ""
echo "🔧 Setting up Backend (Optional)..."
if [ ! -f backend/.env ]; then
    cat > backend/.env << EOF
# Backend Environment Configuration

# OpenAI Configuration
OPENAI_API_KEY=$API_KEY

# Server Configuration
PORT=5050
NODE_ENV=development

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/barrana_ai

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
EOF
    echo "✅ Created .env file for backend"
else
    # Update existing .env file
    if grep -q "OPENAI_API_KEY" backend/.env; then
        sed -i '' "s/OPENAI_API_KEY=.*/OPENAI_API_KEY=$API_KEY/" backend/.env
        echo "✅ Updated existing .env file for backend"
    else
        echo "OPENAI_API_KEY=$API_KEY" >> backend/.env
        echo "✅ Added OpenAI API key to existing .env file"
    fi
fi

echo ""
echo "🎉 Configuration Complete!"
echo "========================="
echo ""
echo "📋 Next Steps:"
echo "1. Restart your development servers:"
echo "   - Web: npm start"
echo "   - Mobile: cd BarranaMobileApp && npx expo start --clear"
echo "   - Backend: cd backend && npm start"
echo ""
echo "2. Test the configuration:"
echo "   - Web: Open browser console and check aiService.isConfigured()"
echo "   - Mobile: Try recording and transcribing audio"
echo ""
echo "3. Monitor usage at: https://platform.openai.com/usage"
echo ""
echo "🔒 Security Note:"
echo "- Keep your API key secure and private"
echo "- Never commit .env files to version control"
echo "- Monitor your OpenAI usage and costs"
echo ""
echo "📖 For more details, see: OPENAI_CONFIGURATION.md" 