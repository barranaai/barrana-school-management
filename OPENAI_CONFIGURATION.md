# 🔑 OpenAI API Key Configuration Guide

## Overview
This guide explains how to configure OpenAI API keys for both the web application and mobile app to enable AI-powered transcription and report generation.

## 📋 Prerequisites

1. **OpenAI Account**: Sign up at [OpenAI Platform](https://platform.openai.com/)
2. **API Key**: Create an API key from your OpenAI dashboard
3. **Billing**: Ensure you have billing set up (OpenAI charges per usage)

## 🌐 Web Application Configuration

### Option 1: Environment Variable (Recommended)

1. **Create `.env` file** in the root directory:
```bash
# Barrana.ai School Management System - Environment Configuration

# OpenAI Configuration
REACT_APP_OPENAI_API_KEY=sk-your-actual-api-key-here

# Backend API Configuration
REACT_APP_API_URL=http://localhost:5050

# Development Configuration
NODE_ENV=development
PORT=3000
```

2. **Restart the development server**:
```bash
npm start
```

### Option 2: Browser localStorage (For Testing)

1. **Open browser console** (F12)
2. **Set the API key**:
```javascript
localStorage.setItem('openai_api_key', 'sk-your-actual-api-key-here');
```
3. **Refresh the page**

### Option 3: Programmatic Setup

1. **Open browser console** (F12)
2. **Import and configure**:
```javascript
import { aiService } from './src/services/aiService';
aiService.setApiKey('sk-your-actual-api-key-here');
```

## 📱 Mobile Application Configuration

### Option 1: Environment Variable (Recommended)

1. **Create `.env` file** in the `BarranaMobileApp` directory:
```bash
# Barrana Mobile App - Environment Configuration

# OpenAI Configuration
EXPO_PUBLIC_OPENAI_API_KEY=sk-your-actual-api-key-here

# Backend API Configuration
EXPO_PUBLIC_API_URL=http://localhost:5050

# Development Configuration
NODE_ENV=development
```

2. **Restart Expo development server**:
```bash
cd BarranaMobileApp
npx expo start --clear
```

### Option 2: Direct Configuration in Code

1. **Edit `BarranaMobileApp/apiService.ts`**:
```typescript
// Replace this line:
const openaiApiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY || 'your-openai-api-key';

// With your actual API key:
const openaiApiKey = 'sk-your-actual-api-key-here';
```

2. **Restart Expo development server**:
```bash
cd BarranaMobileApp
npx expo start --clear
```

## 🔧 Backend Configuration (Optional)

If you want the backend to also use OpenAI for additional features:

1. **Create `.env` file** in the `backend` directory:
```bash
# Backend Environment Configuration

# OpenAI Configuration
OPENAI_API_KEY=sk-your-actual-api-key-here

# Server Configuration
PORT=5050
NODE_ENV=development

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/barrana_ai

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

2. **Restart the backend server**:
```bash
cd backend
npm start
```

## 🧪 Testing the Configuration

### Web Application Test

1. **Open browser console** (F12)
2. **Test the configuration**:
```javascript
import { aiService } from './src/services/aiService';
console.log('API Key configured:', aiService.isConfigured());
console.log('API Key source:', aiService.getApiKeyStatus());
```

### Mobile Application Test

1. **Open the mobile app**
2. **Try recording and transcribing** audio
3. **Check console logs** for configuration status

## 🔒 Security Best Practices

### ✅ Do's
- Use environment variables for production
- Keep API keys secure and private
- Monitor API usage and costs
- Use different API keys for development and production

### ❌ Don'ts
- Never commit API keys to version control
- Don't share API keys publicly
- Don't use the same key for multiple projects
- Don't exceed your OpenAI usage limits

## 💰 Cost Management

### OpenAI Pricing (as of 2024)
- **Whisper (Transcription)**: $0.006 per minute
- **GPT-4 (Report Generation)**: $0.03 per 1K tokens
- **GPT-3.5-turbo**: $0.002 per 1K tokens

### Usage Monitoring
1. **OpenAI Dashboard**: Monitor usage at [OpenAI Platform](https://platform.openai.com/usage)
2. **Set Usage Limits**: Configure spending limits in your OpenAI account
3. **Track Costs**: Monitor monthly spending and adjust as needed

## 🚨 Troubleshooting

### Common Issues

1. **"API key not configured"**
   - Check if the environment variable is set correctly
   - Restart the development server
   - Verify the API key format (starts with `sk-`)

2. **"Transcription failed"**
   - Check API key validity
   - Verify billing is set up
   - Check audio file format (should be supported by Whisper)

3. **"Rate limit exceeded"**
   - Check your OpenAI usage limits
   - Implement rate limiting in your application
   - Consider upgrading your OpenAI plan

### Debug Steps

1. **Check API Key Status**:
```javascript
// Web app
console.log('API Key configured:', aiService.isConfigured());

// Mobile app
console.log('API Key:', process.env.EXPO_PUBLIC_OPENAI_API_KEY ? 'SET' : 'NOT SET');
```

2. **Test API Connection**:
```javascript
// Web app
aiService.testConnection().then(result => console.log(result));

// Mobile app
// Check console logs during transcription
```

3. **Verify Environment Variables**:
```bash
# Web app
echo $REACT_APP_OPENAI_API_KEY

# Mobile app
echo $EXPO_PUBLIC_OPENAI_API_KEY
```

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Verify your OpenAI account and billing status
3. Review the console logs for detailed error messages
4. Contact support with specific error details

---

**Note**: Replace `sk-your-actual-api-key-here` with your real OpenAI API key in all examples above. 