#!/bin/bash

# Barrana AI School Management System - Server Setup Script
# Run this script on your Ubuntu/Debian server to install requirements

set -e

echo "🚀 Setting up server for Barrana AI School Management System..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if running as root or with sudo
if [[ $EUID -ne 0 ]] && ! sudo -n true 2>/dev/null; then
   print_error "This script needs to run as root or with sudo privileges"
   echo "Try: sudo ./server-setup.sh"
   exit 1
fi

# Detect OS
if [[ -f /etc/os-release ]]; then
    . /etc/os-release
    OS=$NAME
    VER=$VERSION_ID
else
    print_error "Cannot detect OS version"
    exit 1
fi

print_info "Detected OS: $OS $VER"

# Update system
print_info "Updating system packages..."
if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
    apt update && apt upgrade -y
    print_status "System updated"
elif [[ "$OS" == *"CentOS"* ]] || [[ "$OS" == *"Red Hat"* ]]; then
    yum update -y
    print_status "System updated"
else
    print_warning "Unsupported OS. Please install Docker manually."
fi

# Install Docker
print_info "Installing Docker..."
if ! command -v docker &> /dev/null; then
    # Install Docker using official script
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    
    # Start and enable Docker
    systemctl start docker
    systemctl enable docker
    
    print_status "Docker installed and started"
else
    print_status "Docker already installed"
fi

# Install Docker Compose
print_info "Installing Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    # Get latest version
    DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
    
    # Download and install
    curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    
    print_status "Docker Compose installed"
else
    print_status "Docker Compose already installed"
fi

# Install useful tools
print_info "Installing useful tools..."
if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
    apt install -y curl wget git nano htop unzip ufw
elif [[ "$OS" == *"CentOS"* ]] || [[ "$OS" == *"Red Hat"* ]]; then
    yum install -y curl wget git nano htop unzip firewalld
fi
print_status "Tools installed"

# Configure firewall
print_info "Configuring firewall..."
if command -v ufw &> /dev/null; then
    # UFW (Ubuntu/Debian)
    ufw --force reset
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow ssh
    ufw allow 22
    ufw allow 80
    ufw allow 443
    ufw allow 3000  # Frontend
    ufw allow 5050  # Backend
    ufw --force enable
    print_status "UFW firewall configured"
elif command -v firewall-cmd &> /dev/null; then
    # FirewallD (CentOS/RHEL)
    systemctl start firewalld
    systemctl enable firewalld
    firewall-cmd --permanent --add-service=ssh
    firewall-cmd --permanent --add-service=http
    firewall-cmd --permanent --add-service=https
    firewall-cmd --permanent --add-port=3000/tcp
    firewall-cmd --permanent --add-port=5050/tcp
    firewall-cmd --reload
    print_status "FirewallD configured"
else
    print_warning "No firewall found. Please configure manually."
fi

# Create app directory
print_info "Creating application directory..."
mkdir -p /opt/barrana-school
chown $SUDO_USER:$SUDO_USER /opt/barrana-school 2>/dev/null || true
print_status "Application directory created at /opt/barrana-school"

# Add user to docker group (if not root)
if [[ $SUDO_USER ]] && [[ $SUDO_USER != "root" ]]; then
    usermod -aG docker $SUDO_USER
    print_status "User $SUDO_USER added to docker group"
    print_warning "Please log out and log back in for docker group changes to take effect"
fi

# Test Docker installation
print_info "Testing Docker installation..."
docker --version
docker-compose --version
print_status "Docker and Docker Compose are working"

# Create swap file if system has less than 2GB RAM
TOTAL_RAM=$(free -m | awk 'NR==2{printf "%.1f", $2/1024}')
if (( $(echo "$TOTAL_RAM < 2.0" | bc -l) )); then
    print_info "System has less than 2GB RAM. Creating swap file..."
    
    if [[ ! -f /swapfile ]]; then
        fallocate -l 2G /swapfile
        chmod 600 /swapfile
        mkswap /swapfile
        swapon /swapfile
        echo '/swapfile none swap sw 0 0' >> /etc/fstab
        print_status "2GB swap file created"
    else
        print_status "Swap file already exists"
    fi
fi

# Display system information
echo ""
print_info "System Information:"
echo "  OS: $OS $VER"
echo "  RAM: ${TOTAL_RAM}GB"
echo "  Disk: $(df -h / | awk 'NR==2 {print $4}') available"
echo "  Docker: $(docker --version | cut -d' ' -f3 | cut -d',' -f1)"
echo "  Docker Compose: $(docker-compose --version | cut -d' ' -f3 | cut -d',' -f1)"

# Next steps
echo ""
print_status "Server setup completed successfully! 🎉"
echo ""
print_info "Next steps:"
echo "  1. Upload your application files to /opt/barrana-school/"
echo "  2. Configure environment variables"
echo "  3. Run the deployment script"
echo ""
print_info "Upload options:"
echo "  📁 Git: git clone <your-repo> /opt/barrana-school"
echo "  📁 SCP: scp -r local-folder/ user@server:/opt/barrana-school/"
echo "  📁 FTP: Upload zip file and extract to /opt/barrana-school/"
echo ""
print_info "After uploading, run:"
echo "  cd /opt/barrana-school"
echo "  ./deploy-simple.sh"
echo ""

# If user was added to docker group, remind about logout
if [[ $SUDO_USER ]] && [[ $SUDO_USER != "root" ]]; then
    print_warning "IMPORTANT: Please log out and log back in for Docker permissions to take effect"
    echo "  Then you can run Docker commands without sudo"
fi

print_status "Setup script completed!"
