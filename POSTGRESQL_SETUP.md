# PostgreSQL Setup Guide for ASTraMind

## 📋 Prerequisites

- PostgreSQL 14 or higher
- pgAdmin 4 (optional, for GUI management)
- Command line access

## 🚀 Installation

### Windows

#### Option 1: Using Official Installer (Recommended)

1. **Download PostgreSQL**
   - Go to https://www.postgresql.org/download/windows/
   - Download the installer for Windows
   - Or use direct link: https://www.enterprisedb.com/downloads/postgres-postgresql-downloads

2. **Run the Installer**
   - Double-click the downloaded `.exe` file
   - Click "Next" through the setup wizard
   - Choose installation directory (default is fine)
   - Select components:
     - ✅ PostgreSQL Server
     - ✅ pgAdmin 4
     - ✅ Command Line Tools
   - Choose data directory (default is fine)
   - **Set a password for the postgres user** (remember this!)
   - Port: 5432 (default)
   - Locale: Default locale
   - Click "Next" and "Finish"

3. **Verify Installation**
   ```powershell
   # Open PowerShell and run:
   psql --version
   ```

#### Option 2: Using Chocolatey

```powershell
# Run PowerShell as Administrator
choco install postgresql

# Start PostgreSQL service
net start postgresql-x64-14
```

### macOS

```bash
# Using Homebrew
brew install postgresql@14

# Start PostgreSQL
brew services start postgresql@14

# Verify installation
psql --version
```

### Linux (Ubuntu/Debian)

```bash
# Update package list
sudo apt update

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify installation
psql --version
```

## 🔧 Initial Configuration

### 1. Access PostgreSQL

**Windows:**
```powershell
# Using psql command line
psql -U postgres

# Or use pgAdmin 4 (GUI)
# Search for "pgAdmin 4" in Start Menu
```

**macOS/Linux:**
```bash
# Switch to postgres user
sudo -u postgres psql

# Or connect directly
psql -U postgres
```

### 2. Create Database and User

```sql
-- Connect to PostgreSQL (you'll be prompted for password)
-- Then run these commands:

-- Create database
CREATE DATABASE astramind;

-- Create user (optional - you can use 'postgres' user)
CREATE USER astramind_user WITH PASSWORD 'your_secure_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE astramind TO astramind_user;

-- Connect to the database
\c astramind

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO astramind_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO astramind_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO astramind_user;

-- Exit
\q
```

### 3. Run Schema Script

**Option A: Using psql command line**

```powershell
# Windows PowerShell
cd C:\Users\ishaa\Downloads\AntiGravity\ASTraMind\backend\src\main\resources
psql -U postgres -d astramind -f schema.sql

# You'll be prompted for the postgres password
```

```bash
# macOS/Linux
cd /path/to/ASTraMind/backend/src/main/resources
psql -U postgres -d astramind -f schema.sql
```

**Option B: Using pgAdmin 4**

1. Open pgAdmin 4
2. Connect to your PostgreSQL server (enter password)
3. Right-click on "Databases" → Create → Database
4. Name: `astramind`
5. Right-click on `astramind` database → Query Tool
6. Open `schema.sql` file
7. Click "Execute" (▶️ button)

**Option C: Copy-paste in psql**

```powershell
# Connect to database
psql -U postgres -d astramind

# Then copy and paste the entire schema.sql content
# Press Enter to execute
```

## ✅ Verify Setup

```sql
-- Connect to database
psql -U postgres -d astramind

-- List all tables
\dt

-- You should see:
-- users
-- codebase_metadata
-- code_files
-- code_embeddings
-- query_history

-- Check table structure
\d users

-- View codebase stats view
\dv

-- Exit
\q
```

## 🔐 Update Application Configuration

Edit `backend/src/main/resources/application.properties`:

```properties
# PostgreSQL Configuration
spring.datasource.url=jdbc:postgresql://localhost:5432/astramind
spring.datasource.username=postgres
spring.datasource.password=YOUR_POSTGRES_PASSWORD

# JPA Configuration
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=true
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect
spring.jpa.properties.hibernate.format_sql=true
```

**Important:** Replace `YOUR_POSTGRES_PASSWORD` with the password you set during installation!

## 🧪 Test Connection

### Option 1: Using Spring Boot

```powershell
# Navigate to backend directory
cd C:\Users\ishaa\Downloads\AntiGravity\ASTraMind\backend

# Run Spring Boot application
mvn spring-boot:run

# Look for this in the logs:
# "HikariPool-1 - Start completed."
# "Started ASTRaMindApplication in X seconds"
```

### Option 2: Using psql

```sql
-- Connect to database
psql -U postgres -d astramind

-- Insert test user
INSERT INTO users (github_id, username, email, avatar_url) 
VALUES (12345678, 'testuser', 'test@example.com', 'https://example.com/avatar.png');

-- Query users
SELECT * FROM users;

-- Clean up test data
DELETE FROM users WHERE github_id = 12345678;
```

## 🛠️ Useful PostgreSQL Commands

```sql
-- List all databases
\l

-- Connect to database
\c astramind

-- List all tables
\dt

-- Describe table structure
\d users
\d codebase_metadata

-- List all views
\dv

-- Show table sizes
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Count records in tables
SELECT 
    'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'codebase_metadata', COUNT(*) FROM codebase_metadata
UNION ALL
SELECT 'code_files', COUNT(*) FROM code_files;

-- Exit psql
\q
```

## 🔄 Reset Database (if needed)

```sql
-- Connect to postgres database (not astramind)
psql -U postgres

-- Drop and recreate database
DROP DATABASE IF EXISTS astramind;
CREATE DATABASE astramind;

-- Reconnect and run schema
\c astramind
\i schema.sql
```

## 🐛 Troubleshooting

### Issue: "psql: command not found"

**Windows:**
- Add PostgreSQL to PATH:
  - Search "Environment Variables" in Start Menu
  - Edit "Path" variable
  - Add: `C:\Program Files\PostgreSQL\14\bin`
  - Restart terminal

**macOS:**
```bash
echo 'export PATH="/usr/local/opt/postgresql@14/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Issue: "password authentication failed"

- Make sure you're using the correct password set during installation
- Try resetting password:
  ```sql
  ALTER USER postgres PASSWORD 'new_password';
  ```

### Issue: "could not connect to server"

**Windows:**
```powershell
# Check if PostgreSQL service is running
Get-Service -Name postgresql*

# Start service if not running
Start-Service postgresql-x64-14
```

**macOS/Linux:**
```bash
# Check status
sudo systemctl status postgresql

# Start service
sudo systemctl start postgresql
```

### Issue: "relation does not exist"

- Make sure you ran `schema.sql` in the correct database
- Verify you're connected to `astramind` database:
  ```sql
  SELECT current_database();
  ```

## 📊 Database Management Tools

### pgAdmin 4 (Included with PostgreSQL)
- GUI tool for managing PostgreSQL
- Access: Start Menu → pgAdmin 4
- Default URL: http://localhost:5050

### DBeaver (Alternative)
- Universal database tool
- Download: https://dbeaver.io/download/
- Supports PostgreSQL and many other databases

### VS Code Extension
- Install "PostgreSQL" extension by Chris Kolkman
- Connect directly from VS Code

## 🎯 Next Steps

1. ✅ PostgreSQL installed and running
2. ✅ Database `astramind` created
3. ✅ Schema tables created
4. ✅ Application properties updated
5. ⏭️ Set up GitHub OAuth credentials
6. ⏭️ Run Spring Boot backend
7. ⏭️ Test authentication flow

## 📝 Quick Reference

```bash
# Start PostgreSQL (Windows)
net start postgresql-x64-14

# Stop PostgreSQL (Windows)
net stop postgresql-x64-14

# Connect to database
psql -U postgres -d astramind

# Backup database
pg_dump -U postgres astramind > astramind_backup.sql

# Restore database
psql -U postgres -d astramind < astramind_backup.sql
```

---

**Need help?** Check the [PostgreSQL Documentation](https://www.postgresql.org/docs/)
