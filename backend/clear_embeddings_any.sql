-- PostgreSQL Script to Clear Embeddings for ANY Codebase

-- First, let's see ALL codebases and their embedding counts
SELECT 
    c.id as codebase_id,
    c.name as codebase_name,
    COUNT(ce.id) as total_embeddings,
    COUNT(CASE WHEN ce.code_element_type = 'CLASS' THEN 1 END) as class_embeddings,
    COUNT(CASE WHEN ce.code_element_type = 'METHOD' THEN 1 END) as method_embeddings
FROM codebases c
LEFT JOIN code_files cf ON cf.codebase_id = c.id
LEFT JOIN code_classes cc ON cc.file_id = cf.id
LEFT JOIN code_embeddings ce ON ce.code_class_id = cc.id
GROUP BY c.id, c.name
ORDER BY c.id;

-- Now delete embeddings for the codebase you want to clear
-- CHANGE THE NUMBER BELOW to match your codebase ID!
-- For example, if you're using codebase 2, change WHERE codebase_id = 2

DELETE FROM code_embeddings 
WHERE code_class_id IN (
    SELECT id FROM code_classes 
    WHERE file_id IN (
        SELECT id FROM code_files 
        WHERE codebase_id = 2  -- CHANGE THIS NUMBER!
    )
);

-- Verify what's left
SELECT 
    c.id as codebase_id,
    c.name as codebase_name,
    COUNT(ce.id) as remaining_embeddings
FROM codebases c
LEFT JOIN code_files cf ON cf.codebase_id = c.id
LEFT JOIN code_classes cc ON cc.file_id = cf.id
LEFT JOIN code_embeddings ce ON ce.code_class_id = cc.id
GROUP BY c.id, c.name
ORDER BY c.id;
