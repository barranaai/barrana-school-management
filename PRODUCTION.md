# Barrana.ai School Management System - Production Deployment Guide

## 🎓 Overview

The Barrana.ai School Management System is a comprehensive, AI-powered platform designed for modern educational institutions. This guide provides complete instructions for deploying the system in production environments.

## 🚀 System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **UI Library**: Material-UI (MUI) v5
- **State Management**: React Context API + React Query
- **Routing**: React Router v6
- **Build Tool**: Vite/Webpack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js (production server)
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT with bcrypt
- **File Storage**: AWS S3 (optional)

### AI Services
- **Report Generation**: OpenAI GPT-4
- **Voice Processing**: Google Cloud Speech-to-Text
- **Analytics**: Custom ML models
- **Predictive Insights**: Advanced analytics engine

## 📋 Prerequisites

### System Requirements
- **OS**: Linux (Ubuntu 20.04+), macOS, or Windows Server
- **Node.js**: Version 18.0.0 or higher
- **Memory**: Minimum 4GB RAM (8GB recommended)
- **Storage**: Minimum 20GB free space
- **Network**: Stable internet connection for AI services

### External Services
- **MongoDB**: Atlas cluster or self-hosted
- **OpenAI API**: GPT-4 access
- **Google Cloud**: Speech-to-Text API
- **Email Service**: SMTP provider (Gmail, SendGrid, etc.)
- **File Storage**: AWS S3 (optional)

## 🔧 Installation & Deployment

### Option 1: Automated Deployment

1. **Clone and Build**
```bash
git clone <repository-url>
cd barrana-ai-school-management
chmod +x scripts/build-production.sh
./scripts/build-production.sh
```

2. **Configure Environment**
```bash
cd dist
cp env.production.example .env
# Edit .env with your configuration
```

3. **Deploy**
```bash
# Direct deployment
./deploy.sh

# Or with Docker
docker-compose up -d
```

### Option 2: Manual Deployment

1. **Install Dependencies**
```bash
npm install --legacy-peer-deps
cd backend && npm install
```

2. **Build Frontend**
```bash
npm run build
```

3. **Configure Environment**
```bash
cp env.production.example .env
# Edit .env with your settings
```

4. **Start Production Server**
```bash
NODE_ENV=production node backend/server-production.js
```

## ⚙️ Configuration

### Environment Variables

#### Required Configuration
```bash
# Server
NODE_ENV=production
PORT=5001
HOST=0.0.0.0

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/barrana-ai

# Security
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRES_IN=7d

# AI Services
OPENAI_API_KEY=your-openai-api-key
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_KEY_FILE=./google-credentials.json
```

#### Optional Configuration
```bash
# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# AWS S3
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=barrana-ai-uploads

# Monitoring
SENTRY_DSN=your-sentry-dsn
NEW_RELIC_LICENSE_KEY=your-new-relic-key
```

### Feature Flags
```bash
# Enable/disable features
FEATURE_VOICE_RECORDING=true
FEATURE_AI_REPORTS=true
FEATURE_REALTIME=true
FEATURE_ANALYTICS=true
FEATURE_EMAIL=true
FEATURE_FILE_UPLOAD=true
```

## 🌐 Access Points

### Application URLs
- **Main Application**: `http://your-domain:5001`
- **API Health Check**: `http://your-domain:5001/api/health`
- **API Documentation**: `http://your-domain:5001/api/docs`

### API Endpoints

#### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/me` - Get current user

#### Data Management
- `GET /api/students` - Get students list
- `GET /api/teachers` - Get teachers list
- `GET /api/schools` - Get schools list

#### AI Services
- `POST /api/ai/generate-report` - Generate AI report
- `POST /api/ai/process-voice` - Process voice recording
- `GET /api/ai/insights` - Get AI insights

#### Analytics
- `GET /api/analytics/dashboard` - Dashboard analytics
- `GET /api/analytics/performance` - Performance metrics
- `GET /api/analytics/predictive` - Predictive insights

#### Communication
- `GET /api/communication/messages` - Get messages
- `GET /api/communication/notifications` - Get notifications

#### Real-time
- `GET /api/realtime/status` - System status
- `GET /api/realtime/updates` - Real-time updates

## 🔍 Monitoring & Health Checks

### Health Check Script
```bash
# Run single health check
./scripts/monitor.sh -c

# Start continuous monitoring
./scripts/monitor.sh -m

# Generate system report
./scripts/monitor.sh -r
```

### Health Check Endpoint
```bash
curl http://localhost:5001/api/health
```

Expected Response:
```json
{
  "status": "OK",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 3600,
  "environment": "production",
  "version": "1.0.0",
  "requestCount": 1500,
  "errorCount": 5,
  "activeConnections": 23,
  "memory": {
    "rss": 44187648,
    "heapTotal": 6651904,
    "heapUsed": 4530720
  },
  "features": {
    "voiceRecording": true,
    "aiReports": true,
    "realtimeUpdates": true,
    "advancedAnalytics": true,
    "emailNotifications": true,
    "fileUpload": true
  }
}
```

## 🛡️ Security

### Security Headers
The production server includes the following security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`

### Authentication
- JWT-based authentication with configurable expiration
- Password hashing with bcrypt (12 rounds)
- Role-based access control (RBAC)
- Multi-tenant architecture

### Rate Limiting
- Default: 100 requests per 15 minutes
- Configurable via environment variables
- Slow-down protection for repeated requests

## 📊 Performance Optimization

### Caching Strategy
- Redis caching for frequently accessed data
- Browser caching for static assets
- API response caching

### Database Optimization
- Connection pooling (max 10 connections)
- Indexed queries for performance
- Regular database maintenance

### Resource Management
- Memory usage monitoring
- Automatic garbage collection
- Connection cleanup

## 🔧 Troubleshooting

### Common Issues

#### 1. Port Already in Use
```bash
# Check what's using the port
lsof -i :5001

# Kill the process
kill -9 <PID>

# Or change the port in .env
PORT=5002
```

#### 2. Database Connection Failed
```bash
# Check MongoDB connection
mongo "mongodb://your-connection-string"

# Verify network connectivity
telnet your-mongodb-host 27017
```

#### 3. AI Services Not Working
```bash
# Check OpenAI API key
curl -H "Authorization: Bearer your-api-key" \
     https://api.openai.com/v1/models

# Check Google Cloud credentials
gcloud auth list
```

#### 4. Email Not Sending
```bash
# Test SMTP connection
telnet smtp.gmail.com 587

# Check email configuration in .env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### Log Files
- **Application Logs**: `./logs/combined.log`
- **Error Logs**: `./logs/error.log`
- **Monitor Logs**: `./logs/monitor.log`
- **System Reports**: `./logs/system-report-*.txt`

### Debug Mode
```bash
# Enable debug logging
LOG_LEVEL=debug

# Start with debug output
NODE_ENV=development node backend/server-production.js
```

## 🔄 Updates & Maintenance

### Updating the System
```bash
# Backup current installation
cp -r /opt/barrana-ai /opt/barrana-ai-backup

# Pull latest changes
git pull origin main

# Rebuild and restart
./scripts/build-production.sh
sudo systemctl restart barrana-ai
```

### Database Maintenance
```bash
# Backup database
mongodump --uri="your-mongodb-uri" --out=./backup

# Restore database
mongorestore --uri="your-mongodb-uri" ./backup
```

### Log Rotation
```bash
# Configure logrotate
sudo nano /etc/logrotate.d/barrana-ai

# Add configuration
/opt/barrana-ai/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
}
```

## 📈 Scaling

### Horizontal Scaling
- Load balancer configuration
- Multiple server instances
- Database clustering
- Redis cluster setup

### Vertical Scaling
- Increase server resources
- Optimize database queries
- Add caching layers
- CDN integration

## 🆘 Support

### Emergency Contacts
- **Technical Support**: support@barrana.ai
- **Emergency Hotline**: +1-555-0123
- **Documentation**: https://docs.barrana.ai

### Support Hours
- **Monday - Friday**: 9:00 AM - 6:00 PM EST
- **Weekend**: 10:00 AM - 4:00 PM EST
- **Emergency**: 24/7

### Escalation Process
1. **Level 1**: Basic troubleshooting
2. **Level 2**: Advanced technical support
3. **Level 3**: Engineering team
4. **Level 4**: Emergency response

## 📄 License

This software is licensed under the MIT License. See LICENSE file for details.

## 🏆 System Status

### Current Version: 1.0.0
### Last Updated: January 2024
### Supported Until: December 2025

---

**Barrana.ai School Management System** - Empowering Education with AI 🎓 