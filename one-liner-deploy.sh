#!/bin/bash

# One-liner deployment for Barrana AI School Management System
# Usage: curl -fsSL https://raw.githubusercontent.com/your-repo/school-project/main/one-liner-deploy.sh | bash

set -e

echo "🚀 One-liner deployment for Barrana AI School Management System"
echo "This will set up everything you need on a fresh Ubuntu/Debian server"
echo ""

# Check if we're on a supported OS
if [[ ! -f /etc/os-release ]]; then
    echo "❌ Unsupported operating system"
    exit 1
fi

. /etc/os-release
if [[ "$NAME" != *"Ubuntu"* ]] && [[ "$NAME" != *"Debian"* ]]; then
    echo "❌ This script only supports Ubuntu/Debian. Detected: $NAME"
    echo "Please use manual deployment for other operating systems."
    exit 1
fi

echo "✅ Detected: $NAME $VERSION_ID"

# Check if running with sufficient privileges
if [[ $EUID -ne 0 ]] && ! sudo -n true 2>/dev/null; then
   echo "❌ This script needs sudo privileges"
   echo "Run with: curl -fsSL <script-url> | sudo bash"
   exit 1
fi

# Install git if not present
if ! command -v git &> /dev/null; then
    echo "📦 Installing git..."
    apt update
    apt install -y git
fi

# Clone or download the repository
APP_DIR="/opt/barrana-school"
echo "📁 Setting up application directory..."

if [[ -d "$APP_DIR" ]]; then
    echo "⚠️  Directory exists. Backing up..."
    mv "$APP_DIR" "${APP_DIR}.backup.$(date +%Y%m%d_%H%M%S)"
fi

# For demo purposes, we'll create the structure
# In real deployment, replace with your actual repository
echo "📥 Downloading application..."
mkdir -p "$APP_DIR"
cd "$APP_DIR"

# This would be your actual git clone command:
# git clone https://github.com/your-username/barrana-school-management.git .

echo "⚠️  DEMO MODE: Please upload your application files to $APP_DIR"
echo "   Or clone your repository:"
echo "   git clone https://github.com/your-repo/school-project.git $APP_DIR"

# Set up server
echo "🔧 Setting up server requirements..."
curl -fsSL https://get.docker.com | sh
systemctl start docker
systemctl enable docker

# Install Docker Compose
DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Configure firewall
apt install -y ufw
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80
ufw allow 443
ufw allow 3000
ufw allow 5050
ufw --force enable

echo ""
echo "🎉 Server setup completed!"
echo ""
echo "📋 Next steps:"
echo "1. Upload your application files to: $APP_DIR"
echo "2. Configure environment: cp $APP_DIR/backend/production.env $APP_DIR/backend/.env"
echo "3. Edit configuration: nano $APP_DIR/backend/.env"
echo "4. Deploy application: cd $APP_DIR && ./deploy-simple.sh"
echo ""
echo "🌐 After deployment, access your app at:"
echo "   http://$(curl -s ifconfig.me):3000"
echo ""
echo "🔐 Default login credentials:"
echo "   Super Admin: alex.chen@barrana.ai / demo123"
echo "   School Admin: sarah.johnson@brightkids.com / demo123"
echo "   Teacher: emma.wilson@brightkids.com / demo123"
echo ""
echo "📖 Full documentation: $APP_DIR/QUICK_DEPLOY.md"
