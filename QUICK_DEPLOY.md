# ⚡ Quick Deploy - Copy & Paste Commands

## 🎯 Choose Your Method

---

## Method 1: Automated Deploy from Local Machine (EASIEST)

```bash
# Make sure you're in the project directory
cd /Users/faran/school-project

# Commit your changes (if not already committed)
git add .
git commit -m "feat: Updated UI for all dashboards with school branding"
git push origin main

# Run automated deployment
bash scripts/deploy-to-hostinger.sh
```

**What it does**: Automatically pushes code and SSHs into server to deploy

---

## Method 2: Direct Server Update (RECOMMENDED)

**Step 1:** SSH into server
```bash
ssh root@191.101.233.56
```

**Step 2:** Run update script
```bash
cd /var/www/barrana/barrana-school
bash scripts/update-production.sh
```

**That's it!** The script handles everything automatically.

---

## Method 3: Manual Step-by-Step

If you prefer to see each step:

```bash
# 1. SSH into server
ssh root@191.101.233.56

# 2. Navigate to app directory
cd /var/www/barrana/barrana-school

# 3. Create backup
mkdir -p ../backups/backup_$(date +%Y%m%d_%H%M%S)
cp backend/config.env ../backups/backup_$(date +%Y%m%d_%H%M%S)/
cp .env.production ../backups/backup_$(date +%Y%m%d_%H%M%S)/
cp -r backend/uploads ../backups/backup_$(date +%Y%m%d_%H%M%S)/

# 4. Stop backend
pm2 stop barrana-backend

# 5. Pull latest code
git pull origin main

# 6. Install backend dependencies
cd backend
npm install --production
cd ..

# 7. Install frontend dependencies
npm install

# 8. Build frontend
npm run build

# 9. Restart backend
pm2 restart barrana-backend

# 10. Reload Nginx
sudo systemctl reload nginx

# 11. Check status
pm2 status
pm2 logs barrana-backend --lines 20
```

---

## 🔍 Verification Commands

After deployment, check if everything is working:

```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs barrana-backend --lines 50

# Check Nginx
sudo systemctl status nginx

# Test API
curl http://191.101.233.56/api/health

# Test frontend (on your computer)
# Open browser: http://191.101.233.56
```

---

## ✅ Expected Output

### Successful Deployment
```
✅ Backend is running (pm2 status shows "online")
✅ Nginx is active (systemctl status nginx shows "active")
✅ API health returns: {"success": true, "status": "healthy"}
✅ Frontend loads in browser without errors
✅ Login works for all user types
✅ School branding displays correctly
```

---

## 🆘 If Something Goes Wrong

### Backend won't start
```bash
# Check logs
pm2 logs barrana-backend --lines 100

# Try restart
pm2 restart barrana-backend

# If still failing, check dependencies
cd /var/www/barrana/barrana-school/backend
npm install --production
pm2 restart barrana-backend
```

### Frontend not updating
```bash
# Rebuild frontend
cd /var/www/barrana/barrana-school
npm run build
sudo systemctl reload nginx

# Clear browser cache or try incognito mode
```

### Need to rollback
```bash
# Find latest backup
cd /var/www/barrana/backups
ls -lt

# Restore (replace TIMESTAMP with actual backup folder)
cd /var/www/barrana/barrana-school
pm2 stop barrana-backend
cp ../backups/backup_TIMESTAMP/config.env backend/
cp ../backups/backup_TIMESTAMP/.env.production ./
pm2 restart barrana-backend
```

---

## 📊 Monitoring After Deployment

Keep these running in separate terminal windows:

### Terminal 1: Watch PM2 logs
```bash
ssh root@191.101.233.56
pm2 logs barrana-backend
```

### Terminal 2: Watch Nginx logs
```bash
ssh root@191.101.233.56
tail -f /var/log/nginx/access.log
```

### Terminal 3: System monitoring
```bash
ssh root@191.101.233.56
htop  # or just: top
```

---

## 🎉 Success Checklist

After deployment, test these:

- [ ] Frontend loads: http://191.101.233.56
- [ ] Login as **Admin** - Dashboard shows correctly
- [ ] Login as **Teacher** - All pages show school banner
- [ ] Login as **Parent** - Calendar works with colored dots
- [ ] School logo appears in all banners
- [ ] Generate Report button works
- [ ] No console errors in browser (F12)
- [ ] PM2 logs show no errors

---

## 💡 Pro Tips

1. **Deploy during low traffic** - Early morning or late evening
2. **Watch logs for 15 minutes** after deployment
3. **Test on mobile** browser as well
4. **Keep backup location** handy: `/var/www/barrana/backups`
5. **Take screenshot** of working dashboard before deploying

---

## 📞 Quick Support Commands

```bash
# Restart everything
ssh root@191.101.233.56 "pm2 restart barrana-backend && sudo systemctl reload nginx"

# Check disk space
ssh root@191.101.233.56 "df -h"

# Check memory
ssh root@191.101.233.56 "free -h"

# Check MongoDB
ssh root@191.101.233.56 "sudo systemctl status mongod"
```

---

**Need detailed help?** See: `PRODUCTION_DEPLOYMENT_GUIDE.md`

**Summary of changes?** See: `DEPLOYMENT_SUMMARY.md`

**Quick checklist?** See: `DEPLOYMENT_CHECKLIST.md`

