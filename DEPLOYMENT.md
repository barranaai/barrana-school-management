# 🚀 Barrana AI School Management System - Production Deployment Guide

This guide covers deploying the Barrana AI School Management System to a production server.

## 📋 Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ (for building frontend)
- Domain name pointed to your server (for SSL)
- Basic server administration knowledge

## 🔧 Quick Deployment Options

### Option 1: Simple Deployment (Recommended for Getting Started)

```bash
# Clone the repository
git clone <your-repo-url>
cd school-project

# Install frontend dependencies and build
npm install
npm run build:production

# Run simple deployment
./deploy-simple.sh
```

This will start:
- Frontend at `http://localhost:3000`
- Backend API at `http://localhost:5050`
- MongoDB database

### Option 2: Full Production Deployment

```bash
# Run full deployment with monitoring
./deploy.sh your-domain.com admin@your-domain.com production
```

This includes:
- All services from simple deployment
- Nginx reverse proxy
- SSL/HTTPS support
- Prometheus monitoring
- Grafana dashboards
- Redis caching

## ⚙️ Configuration

### 1. Backend Environment Variables

Copy and edit the environment file:
```bash
cp backend/production.env backend/.env
nano backend/.env
```

**Required Variables:**
```env
# Database (update for production)
MONGODB_URI=mongodb://mongo:27017/barrana_school

# Security (CHANGE THESE!)
JWT_SECRET=your-super-secret-jwt-key-change-this

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# AI Services
OPENAI_API_KEY=your-openai-api-key
```

### 2. Domain Configuration

Update `docker-compose.yml` with your domain:
```yaml
environment:
  - REACT_APP_API_URL=https://your-domain.com
```

## 🌐 Server Setup

### 1. Install Docker on Ubuntu/Debian
```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
sudo usermod -aG docker $USER
```

### 2. Firewall Configuration
```bash
# Allow necessary ports
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 22
sudo ufw enable
```

### 3. Deploy Application
```bash
# Upload your code to server
# Run deployment script
./deploy-simple.sh
```

## 🔒 SSL/HTTPS Setup

### Using Let's Encrypt (Recommended)

1. **Stop Nginx container temporarily:**
```bash
docker-compose stop nginx
```

2. **Generate SSL certificate:**
```bash
docker run --rm -v "$(pwd)/ssl:/etc/letsencrypt" -p 80:80 certbot/certbot certonly --standalone -d your-domain.com --email admin@your-domain.com --agree-tos --no-eff-email
```

3. **Update nginx.conf for HTTPS:**
```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /etc/nginx/ssl/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/live/your-domain.com/privkey.pem;
    
    # ... rest of configuration
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

4. **Restart Nginx:**
```bash
docker-compose restart nginx
```

## 📊 Monitoring & Maintenance

### Access Monitoring Dashboards
- **Grafana:** `http://your-domain:3001` (admin/admin123)
- **Prometheus:** `http://your-domain:9090`

### Useful Commands

```bash
# View all container logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend

# Restart a service
docker-compose restart backend

# Update and restart all services
docker-compose down
docker-compose up -d --build

# Backup database
docker-compose exec mongo mongodump --out /backup

# Restore database
docker-compose exec mongo mongorestore /backup
```

### Health Checks
```bash
# Check backend health
curl http://localhost:5050/api/health

# Check frontend
curl http://localhost:3000

# Check all services
docker-compose ps
```

## 🗄️ Database Management

### Backup Strategy
```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker-compose exec -T mongo mongodump --archive=/tmp/backup_$DATE.gz --gzip
docker cp $(docker-compose ps -q mongo):/tmp/backup_$DATE.gz ./backups/
docker-compose exec mongo rm /tmp/backup_$DATE.gz
EOF

chmod +x backup.sh

# Run daily backup
echo "0 2 * * * /path/to/backup.sh" | crontab -
```

### Database Connection
```bash
# Connect to MongoDB shell
docker-compose exec mongo mongosh barrana_school

# View collections
show collections

# Example queries
db.users.find({role: "super_admin"})
db.schools.find()
```

## 🔧 Troubleshooting

### Common Issues

1. **Frontend not loading:**
   - Check if build completed: `ls -la build/`
   - Verify nginx configuration
   - Check frontend container logs

2. **Backend API errors:**
   - Verify environment variables in `backend/.env`
   - Check MongoDB connection
   - Review backend logs

3. **Database connection issues:**
   - Ensure MongoDB container is running
   - Check MongoDB logs: `docker-compose logs mongo`
   - Verify connection string format

4. **SSL certificate issues:**
   - Ensure domain DNS points to server
   - Check firewall allows ports 80/443
   - Verify certificate files exist

### Debug Mode
```bash
# Run with debug logging
NODE_ENV=development docker-compose up

# Check resource usage
docker stats

# Inspect container
docker-compose exec backend sh
```

## 📈 Performance Optimization

### Production Settings
- Enable gzip compression in nginx
- Set proper cache headers for static assets
- Configure MongoDB indexes
- Use CDN for static assets
- Enable Redis caching

### Scaling
- Use nginx load balancer for multiple backend instances
- Implement database replication
- Add container orchestration (Kubernetes)
- Use external MongoDB service (Atlas)

## 🔐 Security Checklist

- [ ] Change all default passwords
- [ ] Use strong JWT secrets
- [ ] Enable HTTPS with valid certificates
- [ ] Configure firewall rules
- [ ] Regular security updates
- [ ] Backup encryption
- [ ] Monitor access logs
- [ ] Implement rate limiting
- [ ] Use environment variables for secrets
- [ ] Regular dependency updates

## 📞 Support

For deployment issues:
1. Check this documentation
2. Review container logs
3. Test individual services
4. Contact support team

---

**Happy Deploying! 🎉**

The Barrana AI School Management System is now ready for production use.
