#!/bin/bash
# ASTraMind PostgreSQL Quick Setup Script for macOS/Linux
# This script helps you set up the PostgreSQL database quickly

echo "========================================"
echo "ASTraMind PostgreSQL Setup"
echo "========================================"
echo ""

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "[ERROR] PostgreSQL is not installed!"
    echo ""
    echo "Please install PostgreSQL first:"
    echo "  macOS:  brew install postgresql@16"
    echo "  Ubuntu: sudo apt install postgresql postgresql-contrib"
    echo ""
    exit 1
fi

echo "[OK] PostgreSQL is installed"
echo ""

# Prompt for postgres password
read -sp "Enter your postgres password: " POSTGRES_PASSWORD
echo ""
echo ""

# Create database
echo "Creating database 'astramind'..."
PGPASSWORD=$POSTGRES_PASSWORD psql -U postgres -c "CREATE DATABASE astramind;" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "[OK] Database created successfully"
else
    echo "[INFO] Database might already exist, continuing..."
fi
echo ""

# Run schema script
echo "Running schema script..."
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/backend/src/main/resources"
PGPASSWORD=$POSTGRES_PASSWORD psql -U postgres -d astramind -f schema.sql
if [ $? -eq 0 ]; then
    echo "[OK] Schema created successfully"
else
    echo "[ERROR] Failed to create schema"
    exit 1
fi
echo ""

# Verify setup
echo "Verifying setup..."
PGPASSWORD=$POSTGRES_PASSWORD psql -U postgres -d astramind -c "\dt"
echo ""

echo "========================================"
echo "Setup Complete!"
echo "========================================"
echo ""
echo "Database: astramind"
echo "Tables created:"
echo "  - users"
echo "  - codebase_metadata"
echo "  - code_files"
echo "  - code_embeddings"
echo "  - query_history"
echo ""
echo "Next steps:"
echo "1. Update backend/src/main/resources/application.properties"
echo "   - Set spring.datasource.password to your postgres password"
echo "2. Set up GitHub OAuth credentials"
echo "3. Run: cd backend && mvn spring-boot:run"
echo ""
