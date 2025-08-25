# 🚀 Hostinger VPS Deployment Guide

Complete guide to deploy Barrana AI School Management System on your Hostinger VPS.

## 📋 Prerequisites

- Hostinger VPS with root access
- Domain name pointed to your VPS IP
- SSH access to your server

## 🔧 Step 1: Server Setup

### Connect to your VPS
```bash
ssh root@your-server-ip
```

### Update system packages
```bash
apt update && apt upgrade -y
```

### Install essential packages
```bash
apt install -y curl wget git unzip software-properties-common
```

## 🟢 Step 2: Install Node.js and npm

### Install Node.js 18.x (LTS)
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt install -y nodejs
```

### Verify installation
```bash
node --version  # Should show v18.x.x
npm --version   # Should show 9.x.x or higher
```

## 🍃 Step 3: Install MongoDB

### Import MongoDB GPG key
```bash
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | apt-key add -
```

### Add MongoDB repository
```bash
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-6.0.list
```

### Install MongoDB
```bash
apt update
apt install -y mongodb-org
```

### Start and enable MongoDB
```bash
systemctl start mongod
systemctl enable mongod
systemctl status mongod  # Check if running
```

## 🌐 Step 4: Install Nginx

```bash
apt install -y nginx
systemctl start nginx
systemctl enable nginx
```

## 📦 Step 5: Install PM2 (Process Manager)

```bash
npm install -g pm2
```

## 🔒 Step 6: Create Application User

```bash
adduser --system --group --home /var/www/barrana barrana
```

## 📁 Step 7: Deploy the Application

### Switch to application directory
```bash
cd /var/www/barrana
```

### Clone repository
```bash
git clone https://github.com/barranaai/barrana-school-management.git app
cd app
```

### Set proper ownership
```bash
chown -R barrana:barrana /var/www/barrana
```

## 🔧 Step 8: Backend Setup

### Install backend dependencies
```bash
cd /var/www/barrana/app/backend
npm install --production
```

### Create environment file
```bash
cp config.env.example config.env
nano config.env
```

**Configure the following variables:**
```env
NODE_ENV=production
PORT=3001
MONGODB_URI=mongodb://localhost:27017/barrana_ai
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRE=30d
JWT_COOKIE_EXPIRE=30

# Email Configuration (optional)
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=587
SMTP_EMAIL=noreply@yourdomain.com
SMTP_PASSWORD=your-email-password

# OpenAI (optional)
OPENAI_API_KEY=your-openai-api-key

# Frontend URL
FRONTEND_URL=https://yourdomain.com
```

## 🎨 Step 9: Frontend Setup

### Install frontend dependencies and build
```bash
cd /var/www/barrana/app
npm install
```

### Create production environment file
```bash
echo "REACT_APP_API_URL=https://yourdomain.com/api" > .env.production
```

### Build frontend
```bash
npm run build
```

## ⚙️ Step 10: Configure PM2

### Create PM2 ecosystem file
```bash
cat > /var/www/barrana/app/ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'barrana-backend',
    script: './backend/server.js',
    cwd: '/var/www/barrana/app',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/backend-error.log',
    out_file: './logs/backend-out.log',
    log_file: './logs/backend.log',
    time: true,
    watch: false,
    max_restarts: 5,
    restart_delay: 5000
  }]
};
EOF
```

### Create logs directory
```bash
mkdir -p /var/www/barrana/app/logs
chown -R barrana:barrana /var/www/barrana/app/logs
```

### Start backend with PM2
```bash
cd /var/www/barrana/app
sudo -u barrana pm2 start ecosystem.config.js
```

### Save PM2 configuration and set up startup
```bash
sudo -u barrana pm2 save
sudo -u barrana pm2 startup
# Follow the instructions provided by pm2 startup command
```

## 🌐 Step 11: Configure Nginx

### Remove default configuration
```bash
rm /etc/nginx/sites-enabled/default
```

### Create application configuration
```bash
cat > /etc/nginx/sites-available/barrana << EOF
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Serve static frontend files
    root /var/www/barrana/app/build;
    index index.html;
    
    # Frontend routes (React Router)
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    # Backend API routes
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # Static assets with caching
    location /static {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Uploads directory
    location /uploads {
        alias /var/www/barrana/app/backend/uploads;
        expires 1d;
        add_header Cache-Control "public";
    }
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
}
EOF
```

### Enable the site
```bash
ln -s /etc/nginx/sites-available/barrana /etc/nginx/sites-enabled/
```

### Test and restart Nginx
```bash
nginx -t
systemctl restart nginx
```

## 🔒 Step 12: Setup SSL with Let's Encrypt (Optional but Recommended)

### Install Certbot
```bash
apt install -y certbot python3-certbot-nginx
```

### Obtain SSL certificate
```bash
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### Auto-renewal setup
```bash
crontab -e
# Add this line:
0 12 * * * /usr/bin/certbot renew --quiet
```

## 📊 Step 13: Setup Database

### Create super admin user in MongoDB
```bash
mongosh
```

In MongoDB shell:
```javascript
use barrana_ai

db.users.insertOne({
  firstName: "Super",
  lastName: "Admin",
  email: "admin@barrana.ai",
  password: "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewLjewfKjANx6d3e", // password: admin123
  role: "super_admin",
  isActive: true,
  isEmailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date()
})

exit
```

## 🚀 Step 14: Final Steps

### Check PM2 status
```bash
sudo -u barrana pm2 list
sudo -u barrana pm2 logs barrana-backend
```

### Check Nginx status
```bash
systemctl status nginx
```

### Test the application
```bash
curl http://localhost:3001/api/health
curl http://yourdomain.com/api/health
```

## 🔧 Maintenance Commands

### View backend logs
```bash
sudo -u barrana pm2 logs barrana-backend
```

### Restart backend
```bash
sudo -u barrana pm2 restart barrana-backend
```

### Update application
```bash
cd /var/www/barrana/app
git pull origin main
npm run build
sudo -u barrana pm2 restart barrana-backend
```

### MongoDB operations
```bash
# Backup database
mongodump --db barrana_ai --out /backup/mongodb/$(date +%Y%m%d)

# Restore database
mongorestore --db barrana_ai /backup/mongodb/20240101/barrana_ai
```

## 🔥 Firewall Configuration

```bash
ufw allow ssh
ufw allow 80
ufw allow 443
ufw enable
```

## 📈 Monitoring Setup (Optional)

### Install htop for system monitoring
```bash
apt install -y htop
```

### Setup log rotation
```bash
cat > /etc/logrotate.d/barrana << EOF
/var/www/barrana/app/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    notifempty
    create 640 barrana barrana
    postrotate
        sudo -u barrana pm2 reloadLogs
    endscript
}
EOF
```

## 🎯 Default Login Credentials

- **Email**: admin@barrana.ai
- **Password**: admin123

**🔒 Important**: Change the admin password immediately after first login!

## 🌟 Your Application URLs

- **Frontend**: https://yourdomain.com
- **Backend API**: https://yourdomain.com/api
- **Health Check**: https://yourdomain.com/api/health

---

## 🆘 Troubleshooting

### Backend not starting
```bash
sudo -u barrana pm2 logs barrana-backend
cd /var/www/barrana/app/backend && node server.js
```

### Frontend not loading
```bash
nginx -t
systemctl restart nginx
ls -la /var/www/barrana/app/build/
```

### Database connection issues
```bash
systemctl status mongod
mongosh
```

---

**🎉 Congratulations! Your Barrana AI School Management System is now deployed on your Hostinger VPS!**
