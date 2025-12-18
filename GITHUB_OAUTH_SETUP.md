# GitHub OAuth Setup Instructions

## 🔐 Setting Up GitHub OAuth

To enable GitHub authentication in ASTraMind, you need to create a GitHub OAuth App.

### Step 1: Create OAuth App

1. **Go to GitHub Developer Settings**
   - Visit: https://github.com/settings/developers
   - Or navigate: GitHub → Settings → Developer settings → OAuth Apps

2. **Click "New OAuth App"**

3. **Fill in the Application Details:**

   ```
   Application name: ASTraMind
   
   Homepage URL: http://localhost:5173
   
   Application description: AI Codebase Intelligence System
   
   Authorization callback URL: http://localhost:8080/api/auth/github/callback
   ```

   > ⚠️ **Important**: The callback URL must be EXACTLY:
   > `http://localhost:8080/api/auth/github/callback`

4. **Click "Register application"**

### Step 2: Get Your Credentials

After creating the app, you'll see:
- **Client ID** (visible immediately)
- **Client Secret** (click "Generate a new client secret")

⚠️ **Copy both values immediately** - you won't be able to see the secret again!

### Step 3: Update Application Configuration

Open `backend/src/main/resources/application.properties` and update:

```properties
# GitHub OAuth Configuration
github.oauth.client-id=YOUR_CLIENT_ID_HERE
github.oauth.client-secret=YOUR_CLIENT_SECRET_HERE
```

Replace:
- `YOUR_CLIENT_ID_HERE` with your actual Client ID
- `YOUR_CLIENT_SECRET_HERE` with your actual Client Secret

### Step 4: Save the File

Save `application.properties` after making the changes.

---

## ✅ Verification

Your `application.properties` should now have:

```properties
# Server Configuration
server.port=8080
spring.application.name=astramind

# PostgreSQL Configuration
spring.datasource.url=jdbc:postgresql://localhost:5432/astramind
spring.datasource.username=postgres
spring.datasource.password=root
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=true
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect

# Neo4j Configuration (for future use)
spring.neo4j.uri=bolt://localhost:7687
spring.neo4j.authentication.username=neo4j
spring.neo4j.authentication.password=password

# File Upload Configuration
spring.servlet.multipart.max-file-size=500MB
spring.servlet.multipart.max-request-size=500MB

# GitHub OAuth Configuration
github.oauth.client-id=YOUR_ACTUAL_CLIENT_ID
github.oauth.client-secret=YOUR_ACTUAL_CLIENT_SECRET
github.oauth.redirect-uri=http://localhost:8080/api/auth/github/callback
github.oauth.authorization-url=https://github.com/login/oauth/authorize
github.oauth.token-url=https://github.com/login/oauth/access_token
github.oauth.user-info-url=https://api.github.com/user

# Google Gemini API Configuration (for future AI features)
gemini.api.key=${GEMINI_API_KEY:your_gemini_api_key_here}
gemini.api.model=gemini-1.5-flash
gemini.api.embedding-model=text-embedding-004

# CORS Configuration
cors.allowed-origins=http://localhost:3000,http://localhost:5173

# Session Configuration
server.servlet.session.timeout=24h
server.servlet.session.cookie.http-only=true
server.servlet.session.cookie.secure=false

# Logging
logging.level.com.astramind=DEBUG
logging.level.org.springframework.web=INFO
```

---

## 🚀 Next Steps

After setting up GitHub OAuth:

1. ✅ PostgreSQL database is ready
2. ✅ Application properties configured
3. ⏭️ **Set up GitHub OAuth** (follow steps above)
4. ⏭️ Run the backend: `cd backend && mvn spring-boot:run`
5. ⏭️ Run the frontend: `cd frontend && npm run dev`
6. ⏭️ Visit http://localhost:5173

---

## 🔒 Security Notes

- **Never commit** your Client Secret to Git
- For production, use environment variables:
  ```properties
  github.oauth.client-id=${GITHUB_CLIENT_ID}
  github.oauth.client-secret=${GITHUB_CLIENT_SECRET}
  ```
- Update callback URL for production deployment

---

## 🆘 Troubleshooting

### "Invalid redirect_uri"
- Make sure callback URL is exactly: `http://localhost:8080/api/auth/github/callback`
- No trailing slashes
- Check for typos

### "Bad credentials"
- Verify Client ID and Secret are correct
- Make sure you copied the entire secret
- Try generating a new client secret

### OAuth app not working
- Check that the app is not in "Private" mode
- Verify the homepage URL is correct
- Make sure ports 8080 and 5173 are not in use

---

**Ready to continue?** After setting up GitHub OAuth, you can run the application!
