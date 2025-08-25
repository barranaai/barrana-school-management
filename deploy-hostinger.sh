#!/bin/bash

# 🚀 Hostinger VPS Deployment Script for Barrana AI School Management
# Run this script on your Hostinger VPS as root

set -e  # Exit on any error

echo "🚀 Starting Hostinger VPS deployment for Barrana AI..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root (use sudo)"
    exit 1
fi

print_status "Updating system packages..."
apt update && apt upgrade -y

print_status "Installing essential packages..."
apt install -y curl wget git unzip software-properties-common

print_status "Installing Node.js 18.x..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt install -y nodejs

print_status "Node.js version: $(node --version)"
print_status "NPM version: $(npm --version)"

print_status "Installing MongoDB..."
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-6.0.list
apt update
apt install -y mongodb-org

print_status "Starting MongoDB..."
systemctl start mongod
systemctl enable mongod

print_status "Installing Nginx..."
apt install -y nginx
systemctl start nginx
systemctl enable nginx

print_status "Installing PM2..."
npm install -g pm2

print_status "Creating application user..."
if ! id "barrana" &>/dev/null; then
    adduser --system --group --home /var/www/barrana barrana
fi

print_status "Setting up application directory..."
mkdir -p /var/www/barrana
cd /var/www/barrana

print_status "Cloning repository..."
if [ -d "app" ]; then
    print_warning "App directory exists, pulling latest changes..."
    cd app
    git pull origin main
else
    git clone https://github.com/barranaai/barrana-school-management.git app
    cd app
fi

print_status "Setting proper ownership..."
chown -R barrana:barrana /var/www/barrana

print_status "Installing backend dependencies..."
cd /var/www/barrana/app/backend
npm install --production

print_status "Installing frontend dependencies..."
cd /var/www/barrana/app
npm install

print_status "Creating environment files..."
if [ ! -f "backend/config.env" ]; then
    cp backend/config.env.example backend/config.env
    print_warning "Please edit backend/config.env with your configuration!"
fi

if [ ! -f ".env.production" ]; then
    echo "REACT_APP_API_URL=http://191.101.233.56/api" > .env.production
    print_status "Frontend configured to use VPS IP address"
fi

print_status "Building frontend..."
npm run build

print_status "Creating PM2 ecosystem configuration..."
cat > ecosystem.config.js << 'EOF'
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

print_status "Creating logs directory..."
mkdir -p logs
chown -R barrana:barrana logs

print_status "Configuring Nginx..."
rm -f /etc/nginx/sites-enabled/default

cat > /etc/nginx/sites-available/barrana << 'EOF'
server {
    listen 80;
    server_name _;
    
    # Serve static frontend files
    root /var/www/barrana/app/build;
    index index.html;
    
    # Frontend routes (React Router)
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Backend API routes
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
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

ln -sf /etc/nginx/sites-available/barrana /etc/nginx/sites-enabled/

print_status "Testing Nginx configuration..."
nginx -t

print_status "Restarting Nginx..."
systemctl restart nginx

print_status "Creating super admin user in MongoDB..."
mongosh barrana_ai --eval "
db.users.deleteMany({email: 'admin@barrana.ai'});
db.users.insertOne({
  firstName: 'Super',
  lastName: 'Admin',
  email: 'admin@barrana.ai',
  password: '\$2a\$12\$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewLjewfKjANx6d3e',
  role: 'super_admin',
  isActive: true,
  isEmailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date()
});
print('Super admin user created successfully!');
"

print_status "Starting backend with PM2..."
cd /var/www/barrana/app
sudo -u barrana pm2 start ecosystem.config.js

print_status "Saving PM2 configuration..."
sudo -u barrana pm2 save

print_status "Setting up PM2 startup..."
sudo -u barrana pm2 startup systemd -u barrana --hp /var/www/barrana

print_status "Configuring firewall..."
ufw allow ssh
ufw allow 80
ufw allow 443
ufw --force enable

print_status "Setting up log rotation..."
cat > /etc/logrotate.d/barrana << 'EOF'
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

echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "📋 Next Steps:"
echo "1. Edit /var/www/barrana/app/backend/config.env with your settings"
echo "2. Update /var/www/barrana/app/.env.production with your domain"
echo "3. Restart the backend: sudo -u barrana pm2 restart barrana-backend"
echo ""
echo "🌐 Access your application:"
echo "   Frontend: http://your-server-ip"
echo "   Backend API: http://your-server-ip/api/health"
echo ""
echo "🔑 Default login:"
echo "   Email: admin@barrana.ai"
echo "   Password: admin123"
echo ""
echo "📊 Monitoring commands:"
echo "   Backend logs: sudo -u barrana pm2 logs barrana-backend"
echo "   PM2 status: sudo -u barrana pm2 list"
echo "   System status: systemctl status nginx mongod"
echo ""
print_warning "Don't forget to:"
print_warning "1. Change the default admin password"
print_warning "2. Set up SSL with Let's Encrypt if using a domain"
print_warning "3. Configure your environment variables"
