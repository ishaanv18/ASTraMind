-- Fix VARCHAR(255) length constraints in Supabase
-- Run this in Supabase SQL Editor

ALTER TABLE codebase_metadata 
ALTER COLUMN description TYPE VARCHAR(1000),
ALTER COLUMN local_path TYPE VARCHAR(1000),
ALTER COLUMN github_url TYPE VARCHAR(500);
