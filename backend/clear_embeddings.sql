-- PostgreSQL Script to Clear All Embeddings for Codebase ID 1

-- Show current count before deletion
SELECT 
    COUNT(*) as total_embeddings,
    COUNT(CASE WHEN code_element_type = 'CLASS' THEN 1 END) as class_embeddings,
    COUNT(CASE WHEN code_element_type = 'METHOD' THEN 1 END) as method_embeddings
FROM code_embeddings 
WHERE code_class_id IN (
    SELECT id FROM code_classes 
    WHERE file_id IN (
        SELECT id FROM code_files 
        WHERE codebase_id = 1
    )
);

-- Delete all embeddings for codebase ID 1
DELETE FROM code_embeddings 
WHERE code_class_id IN (
    SELECT id FROM code_classes 
    WHERE file_id IN (
        SELECT id FROM code_files 
        WHERE codebase_id = 1
    )
);

-- Verify deletion (should show 0)
SELECT COUNT(*) as remaining_embeddings FROM code_embeddings;
