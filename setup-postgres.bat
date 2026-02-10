@echo off
REM ASTraMind PostgreSQL Quick Setup Script for Windows
REM This script helps you set up the PostgreSQL database quickly

echo ========================================
echo ASTraMind PostgreSQL Setup
echo ========================================
echo.

REM Check if PostgreSQL is installed
where psql >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] PostgreSQL is not installed or not in PATH!
    echo.
    echo Please install PostgreSQL first:
    echo 1. Download from: https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
    echo 2. Run the installer
    echo 3. Remember your postgres password!
    echo 4. Add PostgreSQL to PATH: C:\Program Files\PostgreSQL\16\bin
    echo.
    pause
    exit /b 1
)

echo [OK] PostgreSQL is installed
echo.

REM Prompt for postgres password
set /p POSTGRES_PASSWORD="Enter your postgres password: "
echo.

echo Creating database 'astramind'...
psql -U postgres -c "CREATE DATABASE astramind;" 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Database created successfully
) else (
    echo [INFO] Database might already exist, continuing...
)
echo.

echo Running schema script...
cd /d "%~dp0backend\src\main\resources"
psql -U postgres -d astramind -f schema.sql
if %ERRORLEVEL% EQU 0 (
    echo [OK] Schema created successfully
) else (
    echo [ERROR] Failed to create schema
    pause
    exit /b 1
)
echo.

echo Verifying setup...
psql -U postgres -d astramind -c "\dt"
echo.

echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Database: astramind
echo Tables created:
echo   - users
echo   - codebase_metadata
echo   - code_files
echo   - code_embeddings
echo   - query_history
echo.
echo Next steps:
echo 1. Update backend/src/main/resources/application.properties
echo    - Set spring.datasource.password to your postgres password
echo 2. Set up GitHub OAuth credentials
echo 3. Run: cd backend ^&^& mvn spring-boot:run
echo.
pause
