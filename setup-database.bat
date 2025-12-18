@echo off
REM Add PostgreSQL to PATH for this session
set PATH=%PATH%;C:\Program Files\PostgreSQL\18\bin

REM ASTraMind PostgreSQL Database Setup
echo ========================================
echo ASTraMind PostgreSQL Database Setup
echo ========================================
echo.

echo Step 1: Creating database 'astramind'
echo Please enter your PostgreSQL password when prompted.
echo.

REM Create database
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -c "CREATE DATABASE astramind;"
if %ERRORLEVEL% EQU 0 (
    echo [OK] Database created successfully
) else (
    echo [INFO] Database might already exist, continuing...
)
echo.

echo Step 2: Running schema script
echo.
cd /d "%~dp0backend\src\main\resources"
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d astramind -f schema.sql
if %ERRORLEVEL% EQU 0 (
    echo.
    echo [OK] Schema created successfully!
) else (
    echo.
    echo [ERROR] Failed to create schema
    pause
    exit /b 1
)
echo.

echo Step 3: Verifying setup
echo.
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d astramind -c "\dt"
echo.

echo ========================================
echo Setup Complete! ✓
echo ========================================
echo.
echo Database 'astramind' is ready!
echo.
echo Next steps:
echo 1. Update backend\src\main\resources\application.properties
echo    - Set your postgres password
echo 2. Set up GitHub OAuth credentials
echo 3. Run the application
echo.
pause
