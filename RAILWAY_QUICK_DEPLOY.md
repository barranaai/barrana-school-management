# 🚀 Railway Quick Deployment Guide

## Step 1: Deploy to Railway

1. **Go to Railway Dashboard**: Visit [railway.app](https://railway.app)
2. **Sign up/Login**: Use your GitHub account
3. **Create New Project**: Click "New Project" → "Deploy from GitHub repo"
4. **Select Repository**: Choose `barranaai/barrana-school-management`
5. **Railway will automatically detect**: Node.js backend and deploy

## Step 2: Add MongoDB Database

1. **In Railway Dashboard**: Click "New" → "Database" → "MongoDB"
2. **Railway will automatically**: Connect it to your app
3. **Copy MongoDB URI**: You'll need this for environment variables

## Step 3: Configure Environment Variables

In Railway dashboard, go to your project → "Variables" tab and add:

```env
# Database (Railway MongoDB URI)
MONGODB_URI=mongodb://your-railway-mongodb-uri

# JWT Secret (Generate a strong one)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-12345

# OpenAI API Key
OPENAI_API_KEY=your-openai-api-key-here

# Email Configuration (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Frontend URL (Your Railway domain)
FRONTEND_URL=https://your-app.railway.app

# Environment
NODE_ENV=production
PORT=5050
```

## Step 4: Test Your Deployment

1. **Get your domain**: Railway will provide a domain like `https://your-app.railway.app`
2. **Test health check**: Visit `https://your-app.railway.app/api/health`
3. **Test API**: Visit `https://your-app.railway.app/api/auth/test`

## Step 5: Deploy Frontend (Optional)

For a complete solution, you can also deploy the frontend to Vercel:

1. **Go to Vercel**: [vercel.com](https://vercel.com)
2. **Import from GitHub**: Select the same repository
3. **Configure**: Set root directory to `/` (not `/backend`)
4. **Environment Variables**: Set `REACT_APP_API_URL` to your Railway backend URL

## Troubleshooting

### If deployment fails:
1. **Check logs**: In Railway dashboard → "Deployments" → Click on failed deployment
2. **Verify environment variables**: Make sure all required variables are set
3. **Check MongoDB connection**: Ensure MongoDB URI is correct

### If API calls fail:
1. **Check CORS**: Make sure `FRONTEND_URL` is set correctly
2. **Check authentication**: Verify JWT_SECRET is set
3. **Check database**: Ensure MongoDB is connected

## Support

- **Railway Docs**: [docs.railway.app](https://docs.railway.app)
- **GitHub Issues**: [github.com/barranaai/barrana-school-management/issues](https://github.com/barranaai/barrana-school-management/issues)

---

**🎉 Your Barrana AI School Management System is now deployed on Railway!**
