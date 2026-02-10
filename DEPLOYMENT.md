# ASTraMind Deployment Guide

## Quick Start

### 1. Deploy Backend to Render

1. Go to https://render.com and sign up
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: astramind-backend
   - **Root Directory**: `backend`
   - **Environment**: Docker
   - **Dockerfile Path**: `Dockerfile` (should auto-detect)
   - **Instance Type**: Free

5. Add Environment Variables (click "Advanced" → "Add Environment Variable"):
   ```
   SUPABASE_DB_URL=jdbc:postgresql://db.zxxrxlbfuaoazsnjksgb.supabase.co:5432/postgres?sslmode=require
   SUPABASE_DB_PASSWORD=hellolife
   HIBERNATE_DDL_AUTO=validate
   GITHUB_CLIENT_ID=your_github_client_id
   GITHUB_CLIENT_SECRET=your_github_client_secret
   GROQ_API_KEY=your_groq_api_key
   SENDGRID_API_KEY=your_sendgrid_api_key
   FEEDBACK_RECIPIENT_EMAIL=vit1122334@gmail.com
   FEEDBACK_FROM_EMAIL=vit1122334@gmail.com
   CORS_ALLOWED_ORIGINS=http://localhost:5173
   SESSION_COOKIE_SECURE=true
   NEO4J_URI=bolt://localhost:7687
   NEO4J_USERNAME=neo4j
   NEO4J_PASSWORD=password
   ```

6. Click "Create Web Service"
7. **Copy your backend URL** (e.g., `https://astramind-backend.onrender.com`)

---

### 2. Deploy Frontend to Vercel

1. Go to https://vercel.com and sign up
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

5. Add Environment Variable:
   ```
   VITE_API_BASE_URL=https://astramind-backend.onrender.com
   ```
   (Use the URL from step 1.7)

6. Click "Deploy"
7. **Copy your frontend URL** (e.g., `https://astramind.vercel.app`)

---

### 3. Update CORS Configuration

1. Go back to Render dashboard
2. Find your backend service
3. Go to "Environment" tab
4. Update `CORS_ALLOWED_ORIGINS`:
   ```
   CORS_ALLOWED_ORIGINS=https://astramind.vercel.app
   ```
   (Use the URL from step 2.7)

5. Click "Save Changes"
6. Render will automatically redeploy

---

### 4. Update GitHub OAuth

1. Go to https://github.com/settings/developers
2. Click on your OAuth App
3. Update:
   - **Homepage URL**: `https://astramind.vercel.app`
   - **Authorization callback URL**: `https://astramind-backend.onrender.com/api/auth/github/callback`

4. Save changes

---

### 5. Run SQL Fix on Supabase

1. Go to Supabase Dashboard → SQL Editor
2. Run this SQL:
   ```sql
   ALTER TABLE codebase_metadata 
   ALTER COLUMN description TYPE VARCHAR(1000),
   ALTER COLUMN local_path TYPE VARCHAR(1000),
   ALTER COLUMN github_url TYPE VARCHAR(500);
   ```

---

## Testing Your Deployment

1. Visit your frontend URL: `https://astramind.vercel.app`
2. Click "Login with GitHub"
3. Authorize the app
4. Try:
   - Adding a codebase
   - Parsing code
   - Viewing metrics
   - Submitting feedback

---

## Troubleshooting

### Backend won't start on Render
- Check "Logs" tab in Render
- Verify all environment variables are set
- Ensure database connection works

### CORS errors
- Verify `CORS_ALLOWED_ORIGINS` matches your Vercel URL exactly
- No trailing slash in URLs
- Redeploy backend after changing CORS

### GitHub OAuth fails
- Verify callback URL matches backend URL
- Check GitHub OAuth app settings
- Ensure client ID and secret are correct

---

## Free Tier Limits

- **Render**: Sleeps after 15 minutes of inactivity (first request takes ~30s to wake up)
- **Vercel**: 100GB bandwidth/month
- **Supabase**: 500MB database, 2GB bandwidth/month

---

## Next Steps

After successful deployment:
- Set up custom domain (optional)
- Configure monitoring/alerts
- Set up CI/CD for automatic deployments
- Add production logging
