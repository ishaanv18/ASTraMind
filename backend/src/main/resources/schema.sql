-- ASTraMind Database Setup Script
-- PostgreSQL Database Schema

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS code_embeddings CASCADE;
DROP TABLE IF EXISTS code_files CASCADE;
DROP TABLE IF EXISTS query_history CASCADE;
DROP TABLE IF EXISTS codebase_metadata CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create Users table
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    github_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    avatar_url VARCHAR(500),
    encrypted_access_token VARCHAR(1000),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP,
    CONSTRAINT uk_github_id UNIQUE (github_id)
);

-- Create Codebase Metadata table
CREATE TABLE codebase_metadata (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    primary_language VARCHAR(100) NOT NULL,
    github_url VARCHAR(500),
    local_path VARCHAR(1000),
    file_count INTEGER NOT NULL DEFAULT 0,
    class_count INTEGER,
    function_count INTEGER,
    uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    error_message TEXT,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create Code Files table
CREATE TABLE code_files (
    id BIGSERIAL PRIMARY KEY,
    codebase_id BIGINT NOT NULL,
    file_path VARCHAR(1000) NOT NULL,
    content TEXT,
    language VARCHAR(100) NOT NULL,
    ast_data TEXT,
    line_count INTEGER,
    class_count INTEGER,
    function_count INTEGER,
    CONSTRAINT fk_codebase FOREIGN KEY (codebase_id) REFERENCES codebase_metadata(id) ON DELETE CASCADE
);

-- Create Code Embeddings table (for future AI features)
CREATE TABLE code_embeddings (
    id BIGSERIAL PRIMARY KEY,
    code_file_id BIGINT NOT NULL,
    code_element_type VARCHAR(50) NOT NULL, -- 'CLASS', 'METHOD', 'FUNCTION', 'FILE'
    element_name VARCHAR(500) NOT NULL,
    element_signature TEXT,
    embedding_vector BYTEA, -- Store as binary for FAISS integration
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_code_file FOREIGN KEY (code_file_id) REFERENCES code_files(id) ON DELETE CASCADE
);

-- Create Query History table
CREATE TABLE query_history (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    codebase_id BIGINT,
    query_text TEXT NOT NULL,
    response_text TEXT,
    query_type VARCHAR(50), -- 'QA', 'SEARCH', 'IMPACT_ANALYSIS'
    execution_time_ms INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_query_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_query_codebase FOREIGN KEY (codebase_id) REFERENCES codebase_metadata(id) ON DELETE SET NULL
);

-- Create indexes for better performance
CREATE INDEX idx_users_github_id ON users(github_id);
CREATE INDEX idx_users_username ON users(username);

CREATE INDEX idx_codebase_user_id ON codebase_metadata(user_id);
CREATE INDEX idx_codebase_status ON codebase_metadata(status);
CREATE INDEX idx_codebase_uploaded_at ON codebase_metadata(uploaded_at DESC);

CREATE INDEX idx_code_files_codebase_id ON code_files(codebase_id);
CREATE INDEX idx_code_files_language ON code_files(language);
CREATE INDEX idx_code_files_file_path ON code_files(file_path);

CREATE INDEX idx_embeddings_code_file_id ON code_embeddings(code_file_id);
CREATE INDEX idx_embeddings_element_type ON code_embeddings(code_element_type);
CREATE INDEX idx_embeddings_element_name ON code_embeddings(element_name);

CREATE INDEX idx_query_history_user_id ON query_history(user_id);
CREATE INDEX idx_query_history_codebase_id ON query_history(codebase_id);
CREATE INDEX idx_query_history_created_at ON query_history(created_at DESC);

-- Create a view for codebase statistics
CREATE OR REPLACE VIEW codebase_stats AS
SELECT 
    cm.id,
    cm.name,
    cm.user_id,
    cm.primary_language,
    cm.status,
    COUNT(DISTINCT cf.id) as total_files,
    SUM(cf.line_count) as total_lines,
    SUM(cf.class_count) as total_classes,
    SUM(cf.function_count) as total_functions,
    cm.uploaded_at
FROM codebase_metadata cm
LEFT JOIN code_files cf ON cm.id = cf.codebase_id
GROUP BY cm.id, cm.name, cm.user_id, cm.primary_language, cm.status, cm.uploaded_at;

-- Insert sample data (optional - for testing)
-- Uncomment the following lines if you want to test with sample data

-- INSERT INTO users (github_id, username, email, avatar_url) VALUES
-- (12345678, 'testuser', 'test@example.com', 'https://avatars.githubusercontent.com/u/12345678');

COMMENT ON TABLE users IS 'Stores GitHub authenticated users';
COMMENT ON TABLE codebase_metadata IS 'Stores metadata about uploaded codebases';
COMMENT ON TABLE code_files IS 'Stores individual code files and their AST data';
COMMENT ON TABLE code_embeddings IS 'Stores vector embeddings for semantic search';
COMMENT ON TABLE query_history IS 'Stores user queries and responses for analytics';

-- Grant permissions (adjust username as needed)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_username;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_username;

-- Display success message
SELECT 'ASTraMind database schema created successfully!' AS status;
