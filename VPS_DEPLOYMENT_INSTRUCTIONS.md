# 🚀 Quick VPS Deployment Instructions

## Step 1: Connect to Your VPS
```bash
ssh root@191.101.233.56
```

## Step 2: Download and Run the Deployment Script
```bash
# Download the script
curl -o deploy.sh https://raw.githubusercontent.com/barranaai/barrana-school-management/main/deploy-hostinger.sh

# Make it executable
chmod +x deploy.sh

# Run the deployment
./deploy.sh
```

## Step 3: Access Your Application
After deployment completes (5-10 minutes), access your application at:

- **Frontend**: http://191.101.233.56
- **Backend API**: http://191.101.233.56/api/health
- **Login**: admin@barrana.ai / admin123

## 🔧 Post-Deployment Configuration (Optional)

### Update Environment Variables
```bash
nano /var/www/barrana/app/backend/config.env
```

Add your actual values:
```env
# Email settings (if you want email functionality)
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=587
SMTP_EMAIL=your-email@yourdomain.com
SMTP_PASSWORD=your-email-password

# OpenAI API (if you want AI features)
OPENAI_API_KEY=your-openai-api-key

# JWT Secret (change this!)
JWT_SECRET=your-super-secret-key-here
```

### Restart Backend After Changes
```bash
sudo -u barrana pm2 restart barrana-backend
```

## 📊 Monitoring Commands

### Check Application Status
```bash
# Backend logs
sudo -u barrana pm2 logs barrana-backend

# PM2 status
sudo -u barrana pm2 list

# System services
systemctl status nginx mongod
```

### View System Resources
```bash
htop  # Interactive system monitor
df -h # Disk usage
free -h # Memory usage
```

## 🆘 Troubleshooting

### If Backend Fails to Start
```bash
cd /var/www/barrana/app/backend
node server.js  # Run directly to see errors
```

### If Frontend Doesn't Load
```bash
nginx -t  # Test nginx config
systemctl restart nginx
ls -la /var/www/barrana/app/build/  # Check if frontend built
```

### If Database Issues
```bash
systemctl status mongod
mongosh  # Connect to MongoDB
```

---

**That's it! Your application should be running at http://191.101.233.56**
