#!/bin/bash

# 🚀 AlmaLinux VPS Deployment Script for Barrana AI School Management
# Run this script on your AlmaLinux VPS as root

set -e  # Exit on any error

echo "🚀 Starting AlmaLinux VPS deployment for Barrana AI..."

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

# Detect package manager
if command -v dnf &> /dev/null; then
    PKG_MGR="dnf"
elif command -v yum &> /dev/null; then
    PKG_MGR="yum"
else
    print_error "Neither dnf nor yum found. This script requires AlmaLinux/RHEL/CentOS."
    exit 1
fi

print_status "Detected package manager: $PKG_MGR"

print_status "Updating system packages..."
$PKG_MGR update -y

print_status "Installing essential packages..."
$PKG_MGR install -y curl wget git unzip epel-release

print_status "Installing development tools..."
$PKG_MGR groupinstall -y "Development Tools"

print_status "Installing Node.js 18.x..."
# Install Node.js from NodeSource repository
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
$PKG_MGR install -y nodejs

print_status "Node.js version: $(node --version)"
print_status "NPM version: $(npm --version)"

print_status "Installing MongoDB..."
# Create MongoDB repository file
cat > /etc/yum.repos.d/mongodb-org-6.0.repo << 'EOF'
[mongodb-org-6.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/$releasever/mongodb-org/6.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-6.0.asc
EOF

$PKG_MGR install -y mongodb-org

print_status "Starting MongoDB..."
systemctl start mongod
systemctl enable mongod

print_status "Installing Nginx..."
$PKG_MGR install -y nginx
systemctl start nginx
systemctl enable nginx

print_status "Installing PM2..."
npm install -g pm2

print_status "Creating application user..."
if ! id "barrana" &>/dev/null; then
    useradd -r -s /bin/false -d /var/www/barrana barrana
fi

print_status "Setting up application directory..."
mkdir -p /var/www/barrana
cd /var/www/barrana

print_status "Cloning repository into barrana-school folder..."
if [ -d "barrana-school" ]; then
    print_warning "barrana-school directory exists, pulling latest changes..."
    cd barrana-school
    git pull origin main
else
    git clone https://github.com/barranaai/barrana-school-management.git barrana-school
    cd barrana-school
fi

print_status "Setting proper ownership..."
chown -R barrana:barrana /var/www/barrana

print_status "Installing backend dependencies..."
cd /var/www/barrana/barrana-school/backend
npm install --production

print_status "Installing frontend dependencies..."
cd /var/www/barrana/barrana-school

# Restore frontend package.json if it exists
if [ -f "package-frontend.json" ]; then
    print_status "Restoring frontend package.json..."
    cp package-frontend.json package.json
fi

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
    cwd: '/var/www/barrana/barrana-school',
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
# Backup default config if it exists
if [ -f "/etc/nginx/nginx.conf" ]; then
    cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup
fi

# Remove default server block from main config
sed -i '/server {/,/}/d' /etc/nginx/nginx.conf

cat > /etc/nginx/conf.d/barrana.conf << 'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    
    # Serve static frontend files
    root /var/www/barrana/barrana-school/build;
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
        alias /var/www/barrana/barrana-school/backend/uploads;
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
cd /var/www/barrana/barrana-school
sudo -u barrana pm2 start ecosystem.config.js

print_status "Saving PM2 configuration..."
sudo -u barrana pm2 save

print_status "Setting up PM2 startup..."
sudo -u barrana pm2 startup systemd -u barrana --hp /var/www/barrana

print_status "Configuring firewall..."
# AlmaLinux uses firewalld instead of ufw
systemctl start firewalld
systemctl enable firewalld
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --permanent --add-service=ssh
firewall-cmd --reload

print_status "Setting up log rotation..."
cat > /etc/logrotate.d/barrana << 'EOF'
/var/www/barrana/barrana-school/logs/*.log {
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

# Fix locale warnings
print_status "Fixing locale settings..."
localectl set-locale LANG=en_US.UTF-8

echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "📋 Next Steps:"
echo "1. Edit /var/www/barrana/barrana-school/backend/config.env with your settings"
echo "2. Update /var/www/barrana/barrana-school/.env.production if needed"
echo "3. Restart the backend: sudo -u barrana pm2 restart barrana-backend"
echo ""
echo "🌐 Access your application:"
echo "   Frontend: http://191.101.233.56"
echo "   Backend API: http://191.101.233.56/api/health"
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
