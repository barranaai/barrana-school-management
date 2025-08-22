# 🚀 Quick Deploy - Barrana AI School Management System

This guide will help you deploy the application to any server with Docker in just a few steps.

## 📦 What You Need

1. **A server** (VPS, cloud instance, or dedicated server) with:
   - Ubuntu 20.04+ / CentOS 8+ / Debian 11+
   - At least 2GB RAM, 20GB storage
   - Root access or sudo privileges

2. **A domain name** (optional but recommended)
   - Example: `schoolapp.yourdomain.com`
   - DNS should point to your server's IP

## 🎯 Quick Deploy Steps

### Step 1: Server Setup

**SSH into your server:**
```bash
ssh root@your-server-ip
# or
ssh user@your-server-ip
```

**Install Docker & Docker Compose:**
```bash
# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Add user to docker group (if not root)
usermod -aG docker $USER

# Test installation
docker --version
docker-compose --version
```

### Step 2: Upload Application

**Option A: Using Git (Recommended)**
```bash
# Clone repository
git clone <your-repository-url> /opt/barrana-school
cd /opt/barrana-school

# Or upload via SCP
scp -r school-project/ user@your-server:/opt/barrana-school/
```

**Option B: Upload files directly**
- Zip the `school-project` folder
- Upload to server using FTP/SCP
- Extract in `/opt/barrana-school/`

### Step 3: Configure Environment

```bash
cd /opt/barrana-school

# Copy environment file
cp backend/production.env backend/.env

# Edit configuration (IMPORTANT!)
nano backend/.env
```

**Update these values in `.env`:**
```env
# Change the JWT secret (REQUIRED)
JWT_SECRET=your-super-secret-jwt-key-$(openssl rand -hex 32)

# Update domain
FRONTEND_URL=https://your-domain.com

# Add your OpenAI key (if you have one)
OPENAI_API_KEY=your-actual-openai-key

# Update email settings (optional)
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### Step 4: Deploy Application

```bash
# Make scripts executable
chmod +x deploy-simple.sh deploy.sh

# Option A: Simple deployment (3 services)
./deploy-simple.sh

# Option B: Full deployment (includes monitoring)
./deploy.sh your-domain.com admin@your-domain.com production
```

### Step 5: Configure Firewall

```bash
# Allow HTTP and HTTPS
ufw allow 80
ufw allow 443
ufw allow 22
ufw enable
```

### Step 6: Access Your Application

- **Frontend:** `http://your-server-ip:3000`
- **Backend API:** `http://your-server-ip:5050`
- **Health Check:** `http://your-server-ip:5050/api/health`

## 🔐 Default Login Credentials

The system comes with demo data. Use these credentials to log in:

**Super Admin:**
- Email: `alex.chen@barrana.ai`
- Password: `demo123`

**School Admin:**
- Email: `sarah.johnson@brightkids.com` 
- Password: `demo123`

**Teacher:**
- Email: `emma.wilson@brightkids.com`
- Password: `demo123`

## 🌐 Set Up Domain (Optional)

If you have a domain name:

1. **Point DNS to your server:**
   ```
   A record: schoolapp.yourdomain.com → your-server-ip
   ```

2. **Get SSL certificate:**
   ```bash
   # Stop nginx temporarily
   docker-compose stop nginx

   # Get certificate
   docker run --rm -v "$(pwd)/ssl:/etc/letsencrypt" -p 80:80 \
     certbot/certbot certonly --standalone \
     -d your-domain.com \
     --email admin@your-domain.com \
     --agree-tos --no-eff-email

   # Restart nginx
   docker-compose restart nginx
   ```

3. **Update configuration:**
   - Edit `docker-compose.yml`
   - Change `REACT_APP_API_URL=https://your-domain.com`
   - Restart: `docker-compose restart frontend`

## 🔧 Useful Commands

```bash
# View logs
docker-compose logs -f

# Restart services
docker-compose restart

# Stop all services
docker-compose down

# Update application
git pull
docker-compose up -d --build

# Database backup
docker-compose exec mongo mongodump --archive=/tmp/backup.gz --gzip
docker cp $(docker-compose ps -q mongo):/tmp/backup.gz ./backup-$(date +%Y%m%d).gz

# Check status
docker-compose ps
```

## 🚨 Troubleshooting

**Application not loading?**
```bash
# Check container status
docker-compose ps

# Check logs
docker-compose logs backend
docker-compose logs frontend

# Restart if needed
docker-compose restart
```

**Database connection issues?**
```bash
# Check MongoDB
docker-compose logs mongo

# Connect to database
docker-compose exec mongo mongosh barrana_school
```

**Port conflicts?**
```bash
# Check what's using ports
netstat -tulpn | grep :3000
netstat -tulpn | grep :5050

# Stop conflicting services
sudo systemctl stop apache2  # if using Apache
sudo systemctl stop nginx    # if using system nginx
```

## 📊 Monitoring

If you used the full deployment (`./deploy.sh`):

- **Grafana Dashboard:** `http://your-server-ip:3001`
  - Username: `admin`
  - Password: `admin123`

- **Prometheus:** `http://your-server-ip:9090`

## 🔒 Security Notes

1. **Change default passwords** immediately
2. **Update JWT secret** in `.env`
3. **Enable firewall** (UFW recommended)
4. **Use HTTPS** in production
5. **Regular backups** of database
6. **Update regularly** for security patches

## 📞 Support

If you encounter issues:

1. Check logs: `docker-compose logs [service-name]`
2. Verify configuration files
3. Ensure all required ports are open
4. Check server resources (RAM/disk)

---

**🎉 That's it! Your Barrana AI School Management System should now be running!**

Visit `http://your-server-ip:3000` to access the application.
