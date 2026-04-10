#!/bin/bash

# Deploy PDF Logo Fix to Production Server
# This script uploads the fixed files to the production server

echo "=================================="
echo "📄 PDF Logo Fix Deployment"
echo "=================================="
echo ""

SERVER="root@191.101.233.56"
REMOTE_PATH="/var/www/barrana/barrana-school/backend"
LOCAL_PATH="/Users/faran/school-project/backend"

echo "🔄 Uploading fixed backend files..."
echo ""

# Upload the three fixed files
echo "1️⃣  Uploading pdfService.js..."
scp "$LOCAL_PATH/services/pdfService.js" "$SERVER:$REMOTE_PATH/services/" || {
  echo "❌ Failed to upload pdfService.js"
  exit 1
}

echo "2️⃣  Uploading reports.js (routes)..."
scp "$LOCAL_PATH/routes/reports.js" "$SERVER:$REMOTE_PATH/routes/" || {
  echo "❌ Failed to upload reports.js"
  exit 1
}

echo "3️⃣  Uploading notificationService.js..."
scp "$LOCAL_PATH/services/notificationService.js" "$SERVER:$REMOTE_PATH/services/" || {
  echo "❌ Failed to upload notificationService.js"
  exit 1
}

echo ""
echo "✅ All files uploaded successfully!"
echo ""
echo "🔄 Restarting backend service..."

# Restart the backend service
ssh "$SERVER" "pm2 restart barrana-backend" || {
  echo "❌ Failed to restart backend"
  exit 1
}

echo ""
echo "✅ Backend restarted successfully!"
echo ""
echo "=================================="
echo "🎉 Deployment Complete!"
echo "=================================="
echo ""
echo "📝 What was fixed:"
echo "  • Logo path now correctly reads from school.branding.logo"
echo "  • Removed emoji icons that showed as empty boxes in PDF"
echo "  • Added detailed logging for logo file loading"
echo ""
echo "🧪 To test:"
echo "  1. Login as a teacher on the web app"
echo "  2. Send a report to parents (this generates the PDF)"
echo "  3. Check the PDF - logo should now appear"
echo "  4. Check backend logs for detailed logo loading info:"
echo "     ssh $SERVER 'pm2 logs barrana-backend --lines 50'"
echo ""


