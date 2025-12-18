# 🔐 Environment Variables Configuration

This file contains instructions for setting up environment variables for local development.

## Required Environment Variables

### Backend (application.properties)

Copy `application.properties.example` to `application.properties` and fill in your values:

```properties
# Database Configuration
spring.datasource.url=jdbc:postgresql://localhost:5432/astramind
spring.datasource.username=postgres
spring.datasource.password=YOUR_DB_PASSWORD

# GitHub OAuth
github.oauth.client-id=YOUR_GITHUB_CLIENT_ID
github.oauth.client-secret=YOUR_GITHUB_CLIENT_SECRET

# Groq API
groq.api.key=YOUR_GROQ_API_KEY
```

### Frontend (.env.development)

Already configured for local development:

```
VITE_API_BASE_URL=http://localhost:8080/api
```

## How to Get API Keys

### 1. GitHub OAuth

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in:
   - **Application name**: ASTraMind Local
   - **Homepage URL**: `http://localhost:5173`
   - **Authorization callback URL**: `http://localhost:8080/api/auth/github/callback`
4. Click "Register application"
5. Copy **Client ID** and **Client Secret**

### 2. Groq API Key

1. Go to [Groq Console](https://console.groq.com)
2. Sign up for free account
3. Navigate to **API Keys**
4. Click "Create API Key"
5. Copy the key (starts with `gsk_`)

## Security Notes

⚠️ **NEVER commit `application.properties` with real credentials to GitHub!**

✅ Always use placeholders in committed files  
✅ Use environment variables in production  
✅ Keep `.env` files in `.gitignore`  
✅ Rotate keys if accidentally exposed  

## Production Deployment

For production, set environment variables in your hosting platform (Render, Vercel, etc.) instead of using property files.

See [deployment_guide.md](./deployment_guide.md) for details.
