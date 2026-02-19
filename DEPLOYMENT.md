# MediaDL - Deployment Guide (Vercel + Render)

## 🎯 Overview

This guide will help you deploy MediaDL with:
- **Frontend** → Vercel (serverless)
- **Backend** → Render (web service)
- **Redis** → Render (managed Redis)

**⚠️ Important**: The `nginx/` folder, `docker-compose.yml`, and `.sh` scripts are ONLY for Docker/VPS deployment. **Ignore them** for Vercel + Render deployment.

---

## 📋 Prerequisites

### Required Accounts
1. **GitHub Account** - Code repository
2. **Vercel Account** - Frontend hosting (free tier available)
3. **Render Account** - Backend + Redis hosting (free tier available)

### Required Tools
- Git installed and configured
- GitHub repository: https://github.com/LegendarySumit/MediaDL

---

## 🚀 Step 1: Deploy Backend to Render

### 1.1 Create Redis Instance

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → Select **"Redis"**
3. Configure Redis:
   ```
   Name: mediadl-redis
   Region: Choose closest to you (e.g., Singapore, Oregon)
   Plan: Free (25MB, perfect for job queue)
   Max Memory Policy: allkeys-lru
   ```
4. Click **"Create Redis"**
5. **Save the connection details**:
   - Internal Redis URL (e.g., `redis://red-xxxxx:6379`)
   - External Redis URL (for testing)

### 1.2 Create Backend Web Service

1. Click **"New +"** → Select **"Web Service"**
2. Connect your GitHub repository: `LegendarySumit/MediaDL`
3. Configure the service:
   ```
   Name: mediadl-backend
   Region: Same as Redis (important for low latency)
   Branch: main
   Root Directory: backend
   Runtime: Python 3
   Build Command: pip install -r requirements.txt
   Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT
   ```

4. Select **Plan**: 
   - Free (512MB RAM, sleeps after 15 min inactivity)
   - Or Starter ($7/mo, 512MB RAM, always on)

5. Click **"Create Web Service"** (don't add environment variables yet)

### 1.3 Configure Backend Environment Variables

**After service is created**, go to **"Environment"** tab and add these variables:

#### Required Variables
```bash
# Redis Configuration
REDIS_HOST=red-xxxxx.oregon-redis.render.com
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password-here
REDIS_DB=0

# CORS (you'll update this after Vercel deployment)
CORS_ORIGINS=http://localhost:3000,https://your-app.vercel.app

# Storage Configuration
DOWNLOADS_DIR=/opt/render/project/src/downloads
MAX_STORAGE_GB=1
CLEANUP_ENABLED=true
CLEANUP_INTERVAL_HOURS=1
STORAGE_THRESHOLD_PERCENT=80

# Rate Limiting
RATE_LIMIT_ENABLED=true
VIDEO_REQUESTS_PER_MINUTE=5
AUDIO_REQUESTS_PER_MINUTE=10

# Job Settings
JOB_TIMEOUT_MINUTES=60
JOB_HISTORY_LIMIT=100

# Logging
LOG_LEVEL=INFO
LOG_DIR=/opt/render/project/src/logs
```

**⚠️ Critical Notes**:
- Replace `red-xxxxx.oregon-redis.render.com` with YOUR Redis Internal URL
- Replace `your-redis-password-here` with YOUR Redis password
- We'll update `CORS_ORIGINS` after deploying frontend to Vercel

6. Click **"Save Changes"** - Backend will redeploy automatically

### 1.4 Verify Backend Deployment

1. Wait for build to complete (2-3 minutes)
2. Click the backend URL (e.g., `https://mediadl-backend.onrender.com`)
3. You should see: `{"message":"Media Downloader API is running!"}`
4. Test health: `https://mediadl-backend.onrender.com/health`
5. **Copy your backend URL** - you'll need it for frontend!

---

## 🎨 Step 2: Deploy Frontend to Vercel

### 2.1 Create Vercel Project

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repository: `LegendarySumit/MediaDL`
4. Configure the project:
   ```
   Framework Preset: Next.js
   Root Directory: frontend
   Build Command: npm run build (auto-detected)
   Output Directory: .next (auto-detected)
   Install Command: npm install (auto-detected)
   ```

### 2.2 Configure Frontend Environment Variables

Click **"Environment Variables"** and add:

```bash
# Backend API URL (replace with YOUR Render backend URL)
NEXT_PUBLIC_API_URL=https://mediadl-backend.onrender.com
```

**⚠️ Important**: 
- Replace `https://mediadl-backend.onrender.com` with YOUR actual Render backend URL
- Do NOT include `/api` at the end - just the base URL

### 2.3 Deploy Frontend

1. Click **"Deploy"**
2. Wait for deployment (1-2 minutes)
3. Vercel will provide you with URLs:
   - Production: `https://your-app.vercel.app`
   - Preview: `https://your-app-git-main-username.vercel.app`
4. **Copy your production URL**

### 2.4 Update Backend CORS

Now that you have your Vercel URL, update backend CORS:

1. Go back to **Render Dashboard** → Your backend service
2. Go to **"Environment"** tab
3. Find `CORS_ORIGINS` variable and update it:
   ```bash
   CORS_ORIGINS=https://your-app.vercel.app,http://localhost:3000
   ```
   (Replace `your-app.vercel.app` with YOUR actual Vercel URL)
4. Click **"Save Changes"** - Backend will redeploy

---

## 🧪 Step 3: Test Your Deployment

### 3.1 Basic Functionality Test

1. Visit your Vercel URL: `https://your-app.vercel.app`
2. Check if page loads correctly (light/dark mode toggle works)
3. Try the tool section - select a platform (YouTube, Twitter, etc.)
4. Paste a valid media URL
5. Click **"Start Download"**

### 3.2 Download Test

Test download with these sample URLs:

**YouTube (Video)**:
```
https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

**YouTube (Audio)**:
```
https://www.youtube.com/watch?v=jNQXAC9IVRw
```

**Expected Behavior**:
- Progress modal appears showing download progress
- Progress bar updates in real-time (SSE events)
- Download completes and file downloads to your browser
- Job appears in download history

### 3.3 Download History Test

1. Click navbar link: **"Download History"**
2. Verify your completed download appears
3. Test filters: Status (All/Completed/Failed), Platform (All/YouTube)
4. Test light/dark mode in history page
5. Test "Delete All History" button

---

## 🐛 Troubleshooting

### Issue: CORS Error in Browser Console

**Error**: `Access to fetch at 'https://mediadl-backend.onrender.com/...' from origin 'https://your-app.vercel.app' has been blocked by CORS policy`

**Solution**:
1. Check backend environment variable `CORS_ORIGINS` includes your Vercel URL
2. Ensure no typos in the URL (no trailing slash)
3. Wait 1-2 minutes for backend redeploy after updating CORS
4. Hard refresh browser (Ctrl + Shift + R)

### Issue: Backend not responding / 404 errors

**Error**: `GET https://mediadl-backend.onrender.com/... 404`

**Solution**:
1. Check frontend `NEXT_PUBLIC_API_URL` is set correctly
2. Verify backend is deployed successfully (green status in Render)
3. Test backend health endpoint directly: `https://your-backend.onrender.com/health`
4. Check backend logs in Render for errors

### Issue: Downloads fail immediately

**Error**: "Download failed" message appears instantly

**Solution**:
1. Check backend logs in Render Dashboard → Logs tab
2. Verify Redis connection: Check `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
3. Test Redis connection in Render shell: `redis-cli -h <host> -p <port> -a <password> PING`
4. Ensure yt-dlp can access the URL (some regions block certain platforms)

### Issue: Progress not updating (SSE not working)

**Error**: Progress bar stuck at 0%, modal doesn't update

**Solution**:
1. Check browser console for SSE connection errors
2. Verify backend `/api/events/{job_id}` endpoint is accessible
3. Check if Render free tier is sleeping (takes 30s to wake up on first request)
4. Try upgrading to Render Starter plan ($7/mo) for always-on backend

### Issue: Download history not persisting

**Error**: History disappears after page refresh

**Solution**:
1. Verify Redis is running: Render Dashboard → Redis service (green status)
2. Check Redis connection in backend logs: Should see "Connected to Redis"
3. Verify `REDIS_HOST` is the **Internal URL** (not external)
4. Test Redis: Backend logs should show job creation/update events

### Issue: Backend sleeps on free tier

**Symptom**: First request takes 30+ seconds, then fast

**Solution** (Choose one):
1. **Accept it**: Free tier sleeps after 15 min inactivity - this is normal
2. **Upgrade**: Render Starter plan ($7/mo) keeps backend always running
3. **Keep-alive**: Use a service like UptimeRobot to ping backend every 10 minutes (not recommended, violates Render TOS)

---

## 📊 Monitoring & Maintenance

### Check Backend Health

**Endpoint**: `https://your-backend.onrender.com/health`

**Expected Response**:
```json
{
  "status": "healthy",
  "message": "Service is running",
  "redis_connected": true,
  "disk_space_gb": 8.5,
  "timestamp": "2026-02-10T12:00:00"
}
```

### View Backend Logs

1. Go to Render Dashboard → Your backend service
2. Click **"Logs"** tab
3. Watch real-time logs for errors/warnings
4. Search logs: Use search bar (top right)

### View Vercel Logs

1. Go to Vercel Dashboard → Your project
2. Click **"Deployments"** → Select latest deployment
3. Click **"View Function Logs"** (for API routes)
4. Click **"View Build Logs"** (for deployment issues)

### Redis Monitoring

1. Go to Render Dashboard → Your Redis instance
2. Click **"Metrics"** tab
3. Monitor:
   - Memory usage (should stay under 25MB on free tier)
   - Connection count
   - Command rate

---

## 💰 Cost Breakdown

### Free Tier (Total: $0/month)

- **Vercel**: 
  - 100GB bandwidth/month
  - Unlimited deployments
  - Custom domain supported
  
- **Render Backend**:
  - 512MB RAM
  - Sleeps after 15 min inactivity
  - 750 hours/month free (enough for personal use)
  
- **Render Redis**:
  - 25MB storage (enough for ~100-200 jobs)
  - Persistent data
  - No sleep

**Limitations**:
- Backend wakes up slowly (30s first request)
- Limited Redis storage (deletes old jobs automatically)
- No custom domain on Render free tier

### Paid Tier Recommendations (Total: $7-14/month)

- **Vercel**: $20/month (Pro) - Only if you need team features or more bandwidth
- **Render Backend**: $7/month (Starter) - ⭐ **Highly recommended** for always-on backend
- **Render Redis**: $7/month (Pro) - Only if you need more than 25MB storage

**Best value**: Keep Vercel + Redis free, upgrade only Backend to Starter ($7/mo)

---

## 🔒 Security Checklist

Before going live, ensure:

- ✅ `.env` files are in `.gitignore` (check with `git ls-files | grep .env`)
- ✅ No API keys or secrets committed to GitHub
- ✅ CORS is restricted to your Vercel domain only (not `*`)
- ✅ Rate limiting is enabled (`RATE_LIMIT_ENABLED=true`)
- ✅ Vercel environment variables are set correctly
- ✅ Render environment variables are set correctly
- ✅ Redis password is secure (generated by Render)

---

## 🎉 Post-Deployment

### Custom Domain (Optional)

**Vercel**:
1. Go to Project Settings → Domains
2. Add your domain (e.g., `mediadl.com`)
3. Follow DNS instructions (add CNAME record)
4. Vercel auto-provisions SSL certificate

**Render Backend**:
- Free tier: Use provided subdomain (`*.onrender.com`)
- Paid tier: Can add custom domain in Settings

### Analytics (Optional)

**Vercel Analytics**:
1. Go to Project Settings → Analytics
2. Enable Vercel Analytics (free for personal projects)
3. See real-time visitor data in dashboard

**Google Analytics**:
1. Create GA4 property
2. Add tracking ID to `frontend/app/layout.js`
3. Deploy changes to Vercel

### Update README

Update [README.md](D:/WEBD/MediaDL/README.md) with your live URLs:
```markdown
## 🌐 Live Demo

- **Frontend**: https://your-app.vercel.app
- **Backend**: https://mediadl-backend.onrender.com
```

---

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Render Documentation](https://render.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/)
- [yt-dlp Documentation](https://github.com/yt-dlp/yt-dlp)

---

## ❓ Need Help?

If you encounter issues not covered in troubleshooting:

1. Check backend logs in Render Dashboard
2. Check browser console for frontend errors
3. Verify all environment variables are set correctly
4. Test backend health endpoint
5. Ensure Redis is connected (check backend logs)

**Common mistakes**:
- Forgetting to update CORS after Vercel deployment
- Using External Redis URL instead of Internal URL
- Typo in `NEXT_PUBLIC_API_URL` (missing `https://` or extra `/api`)
- Not waiting for backend redeploy after environment variable changes

---

## 🎊 Success!

If you've followed all steps and tests pass, congratulations! 🎉

Your MediaDL application is now live and accessible worldwide at:
- **https://your-app.vercel.app**

Share it with friends, test different platforms, and enjoy your media downloader!

---

**Last Updated**: February 10, 2026
**Author**: Sumit (LegendarySumit)
**Repository**: https://github.com/LegendarySumit/MediaDL
