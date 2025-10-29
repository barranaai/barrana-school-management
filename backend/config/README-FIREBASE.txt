====================================================
FIREBASE SERVICE ACCOUNT SETUP
====================================================

Place your Firebase service account JSON file here:
- File name: firebase-service-account.json
- Download from: Firebase Console → Project Settings → Service Accounts → Generate new private key

IMPORTANT:
- This file contains sensitive credentials
- NEVER commit to git (already in .gitignore)
- Required for backend to send push notifications

Without this file:
- Push notifications will be disabled
- System will gracefully fall back to in-app notifications only
- No errors, just logged warnings

To enable push notifications:
1. Download service account JSON from Firebase
2. Save as: backend/config/firebase-service-account.json
3. Restart backend server

====================================================
