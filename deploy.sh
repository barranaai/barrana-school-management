#!/bin/bash

# Barrana AI School Management System - Production Deployment Script
set -e

echo "🚀 Starting Barrana AI School Management System Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN=${1:-"your-domain.com"}
EMAIL=${2:-"admin@your-domain.com"}
ENVIRONMENT=${3:-"production"}

echo -e "${BLUE}📋 Deployment Configuration:${NC}"
echo -e "  Domain: ${DOMAIN}"
echo -e "  Email: ${EMAIL}"
echo -e "  Environment: ${ENVIRONMENT}"
echo ""

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

print_status "Docker and Docker Compose are installed"

# Create necessary directories
echo -e "${BLUE}📁 Creating necessary directories...${NC}"
mkdir -p ssl
mkdir -p backend/uploads/{audio,media,logos}
mkdir -p backend/logs
mkdir -p monitoring/{prometheus,grafana/dashboards,grafana/datasources}

print_status "Directories created"

# Copy environment files
echo -e "${BLUE}🔧 Setting up environment configuration...${NC}"

# Backend environment
if [ ! -f "backend/.env" ]; then
    if [ -f "backend/production.env" ]; then
        cp backend/production.env backend/.env
        print_warning "Copied production.env to .env. Please update the values in backend/.env"
    else
        print_error "No environment file found. Please create backend/.env with production values."
        exit 1
    fi
else
    print_status "Backend environment file exists"
fi

# Frontend environment variables (update docker-compose.yml)
echo -e "${BLUE}🌐 Configuring frontend environment...${NC}"

# Update docker-compose.yml with the correct domain
if [ "$DOMAIN" != "your-domain.com" ]; then
    sed -i.bak "s|REACT_APP_API_URL=http://localhost:5050|REACT_APP_API_URL=https://$DOMAIN|g" docker-compose.yml
    print_status "Updated API URL in docker-compose.yml"
fi

# Build the application
echo -e "${BLUE}🏗️  Building the application...${NC}"

# Build frontend
echo "Building frontend..."
npm run build:production
print_status "Frontend built successfully"

# Stop existing containers
echo -e "${BLUE}🛑 Stopping existing containers...${NC}"
docker-compose down --remove-orphans 2>/dev/null || true
print_status "Stopped existing containers"

# Pull latest images
echo -e "${BLUE}📥 Pulling latest base images...${NC}"
docker-compose pull

# Build and start services
echo -e "${BLUE}🚀 Building and starting services...${NC}"
docker-compose up --build -d

# Wait for services to be ready
echo -e "${BLUE}⏳ Waiting for services to be ready...${NC}"
sleep 30

# Check service health
echo -e "${BLUE}🏥 Checking service health...${NC}"

check_service() {
    local service_name=$1
    local port=$2
    local endpoint=${3:-"/health"}
    
    echo "Checking $service_name..."
    if curl -f -s "http://localhost:$port$endpoint" > /dev/null; then
        print_status "$service_name is healthy"
        return 0
    else
        print_error "$service_name is not responding"
        return 1
    fi
}

# Check backend
if check_service "Backend API" 5050 "/api/health"; then
    echo -e "${GREEN}Backend API is running at http://localhost:5050${NC}"
else
    print_warning "Backend API might still be starting up..."
fi

# Check frontend
if check_service "Frontend" 3000 "/"; then
    echo -e "${GREEN}Frontend is running at http://localhost:3000${NC}"
else
    print_warning "Frontend might still be starting up..."
fi

# Check database
if docker-compose exec -T mongo mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
    print_status "MongoDB is healthy"
else
    print_warning "MongoDB might still be starting up..."
fi

# Show running containers
echo -e "${BLUE}📊 Running containers:${NC}"
docker-compose ps

# Display logs for troubleshooting
echo -e "${BLUE}📝 Recent logs:${NC}"
echo "Backend logs:"
docker-compose logs --tail=10 backend
echo ""
echo "Frontend logs:"
docker-compose logs --tail=10 frontend

# SSL Configuration (if domain is provided and not localhost)
if [ "$DOMAIN" != "your-domain.com" ] && [ "$DOMAIN" != "localhost" ]; then
    echo -e "${BLUE}🔒 SSL Configuration${NC}"
    print_warning "To enable SSL with Let's Encrypt, run:"
    echo "  docker run --rm -v \"\$(pwd)/ssl:/etc/letsencrypt\" certbot/certbot certonly --standalone -d $DOMAIN --email $EMAIL --agree-tos --no-eff-email"
    echo ""
    print_warning "Then update nginx.conf to enable HTTPS and restart nginx container"
fi

# Success message
echo ""
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo ""
echo -e "${BLUE}📍 Access your application:${NC}"
echo -e "  🌐 Frontend: http://localhost:3000"
echo -e "  🔧 Backend API: http://localhost:5050"
echo -e "  📊 Grafana Dashboard: http://localhost:3001 (admin/admin123)"
echo -e "  📈 Prometheus: http://localhost:9090"
echo ""
echo -e "${BLUE}🔧 Useful commands:${NC}"
echo -e "  📋 View logs: docker-compose logs -f [service_name]"
echo -e "  🔄 Restart service: docker-compose restart [service_name]"
echo -e "  🛑 Stop all: docker-compose down"
echo -e "  🗂️  Database shell: docker-compose exec mongo mongosh"
echo ""
echo -e "${YELLOW}⚠️  Important:${NC}"
echo -e "  1. Update backend/.env with your production values"
echo -e "  2. Configure domain DNS to point to this server"
echo -e "  3. Set up SSL certificates for HTTPS"
echo -e "  4. Configure firewall rules (ports 80, 443)"
echo -e "  5. Set up backup strategy for MongoDB data"
echo ""
print_status "Deployment script completed!"
