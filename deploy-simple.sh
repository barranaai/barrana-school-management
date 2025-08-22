#!/bin/bash

# Simple deployment script for Barrana AI School Management System
set -e

echo "🚀 Starting Simple Deployment of Barrana AI School Management System..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check requirements
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo -e "${GREEN}✅ Docker and Docker Compose are available${NC}"

# Create environment file if it doesn't exist
if [ ! -f "backend/.env" ]; then
    echo -e "${BLUE}📝 Creating backend environment file...${NC}"
    cp backend/production.env backend/.env
    echo -e "${YELLOW}⚠️  Please update backend/.env with your actual values before continuing${NC}"
    echo -e "   Especially: MONGODB_URI, JWT_SECRET, OPENAI_API_KEY, SMTP settings"
    read -p "Press Enter to continue after updating the .env file..."
fi

# Build frontend
echo -e "${BLUE}🏗️  Building frontend...${NC}"
npm run build:production
echo -e "${GREEN}✅ Frontend built successfully${NC}"

# Create necessary directories
mkdir -p backend/uploads/{audio,media,logos}
mkdir -p backend/logs

# Stop existing containers
echo -e "${BLUE}🛑 Stopping existing containers...${NC}"
docker-compose -f docker-compose.simple.yml down --remove-orphans 2>/dev/null || true

# Start services
echo -e "${BLUE}🚀 Starting services...${NC}"
docker-compose -f docker-compose.simple.yml up --build -d

# Wait for services
echo -e "${BLUE}⏳ Waiting for services to start...${NC}"
sleep 30

# Check health
echo -e "${BLUE}🏥 Checking service health...${NC}"

if curl -f -s http://localhost:5050/api/health > /dev/null; then
    echo -e "${GREEN}✅ Backend is healthy${NC}"
else
    echo -e "${YELLOW}⚠️  Backend might still be starting up${NC}"
fi

if curl -f -s http://localhost:3000 > /dev/null; then
    echo -e "${GREEN}✅ Frontend is healthy${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend might still be starting up${NC}"
fi

# Show status
echo -e "${BLUE}📊 Container status:${NC}"
docker-compose -f docker-compose.simple.yml ps

echo ""
echo -e "${GREEN}🎉 Simple deployment completed!${NC}"
echo ""
echo -e "${BLUE}📍 Access your application:${NC}"
echo -e "  🌐 Frontend: http://localhost:3000"
echo -e "  🔧 Backend API: http://localhost:5050"
echo -e "  📚 API Health: http://localhost:5050/api/health"
echo ""
echo -e "${BLUE}🔧 Useful commands:${NC}"
echo -e "  📋 View logs: docker-compose -f docker-compose.simple.yml logs -f [service]"
echo -e "  🔄 Restart: docker-compose -f docker-compose.simple.yml restart [service]"
echo -e "  🛑 Stop: docker-compose -f docker-compose.simple.yml down"
echo ""
echo -e "${YELLOW}⚠️  Remember to:${NC}"
echo -e "  1. Update backend/.env with production values"
echo -e "  2. Set up proper domain and SSL for production"
echo -e "  3. Configure backup strategy for database"
