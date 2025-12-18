# 🚀 ASTraMind - Quick Start Guide

## What You Have Now

✅ **Complete Full-Stack Application**
- Spring Boot backend with GitHub OAuth
- Beautiful React frontend with modern UI
- PostgreSQL database schema
- Cloud-ready architecture

## 📋 Setup Steps

### 1. Database Setup (5 minutes)

**Quick Option:**
```powershell
# Windows
.\setup-postgres.bat

# macOS/Linux
chmod +x setup-postgres.sh && ./setup-postgres.sh
```

**Manual Option:**
See [POSTGRESQL_SETUP.md](POSTGRESQL_SETUP.md)

### 2. GitHub OAuth Setup (3 minutes)

1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in:
   - **Name**: ASTraMind
   - **Homepage**: `http://localhost:5173`
   - **Callback**: `http://localhost:8080/api/auth/github/callback`
4. Copy Client ID and Secret
5. Update `backend/src/main/resources/application.properties`:
   ```properties
   github.oauth.client-id=YOUR_CLIENT_ID
   github.oauth.client-secret=YOUR_CLIENT_SECRET
   ```

### 3. Run Application (2 minutes)

**Backend:**
```bash
cd backend
mvn spring-boot:run
```

**Frontend:**
```bash
cd frontend
npm run dev
```

**Access:** http://localhost:5173

## 🌐 Cloud Deployment

### Free Tier Deployment (15 minutes)

1. **Database**: Supabase (Free - 500MB)
   - Sign up at https://supabase.com
   - Create project
   - Run `schema.sql` in SQL Editor

2. **Backend**: Render (Free tier)
   - Push to GitHub
   - Connect Render to repo
   - Set environment variables

3. **Frontend**: Vercel (Free tier)
   ```bash
   cd frontend
   vercel
   ```

**See [CLOUD_DEPLOYMENT.md](CLOUD_DEPLOYMENT.md) for detailed instructions**

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [README.md](README.md) | Project overview & features |
| [POSTGRESQL_SETUP.md](POSTGRESQL_SETUP.md) | Database installation guide |
| [CLOUD_DEPLOYMENT.md](CLOUD_DEPLOYMENT.md) | Cloud deployment options |
| [walkthrough.md](.gemini/antigravity/brain/.../walkthrough.md) | Implementation details |

## 🎯 Current Features

- ✅ GitHub OAuth authentication
- ✅ Repository browsing (public & private)
- ✅ Beautiful, animated UI
- ✅ Secure token storage
- ✅ Cloud-ready architecture

## 🚀 Next Steps (Future Development)

1. **Code Ingestion** - Clone repositories
2. **AST Parsing** - Extract code structure
3. **Dependency Graphs** - Visualize relationships
4. **AI Features** - Gemini integration for Q&A
5. **Impact Analysis** - Change risk assessment

## 💡 Key Technologies

- **Backend**: Spring Boot 3.2, PostgreSQL
- **Frontend**: React 18, Vite, Framer Motion
- **Cloud**: AWS, GCP, Azure, Heroku (all supported)
- **AI**: Google Gemini (ready to integrate)

## 🆘 Troubleshooting

### PostgreSQL Issues
- See [POSTGRESQL_SETUP.md](POSTGRESQL_SETUP.md) → Troubleshooting section

### GitHub OAuth Issues
- Verify callback URL matches exactly
- Check Client ID and Secret are correct
- Ensure app is not in private mode

### Build Issues
```bash
# Backend
cd backend
mvn clean install

# Frontend
cd frontend
rm -rf node_modules
npm install
```

## 📞 Support

- **Documentation**: Check the guides above
- **Issues**: Open issue on GitHub
- **Cloud Deployment**: See [CLOUD_DEPLOYMENT.md](CLOUD_DEPLOYMENT.md)

---

**Ready to deploy?** Follow [CLOUD_DEPLOYMENT.md](CLOUD_DEPLOYMENT.md) for production setup!
