-- Clear all embeddings for Codebase ID 4 (AI-Dungeon-Master)

DELETE FROM code_embeddings 
WHERE code_class_id IN (
    SELECT id FROM code_classes 
    WHERE file_id IN (
        SELECT id FROM code_files 
        WHERE codebase_id = 4
    )
);

-- Verify deletion
SELECT 
    c.id as codebase_id,
    c.name as codebase_name,
    COUNT(ce.id) as total_embeddings,
    COUNT(CASE WHEN ce.code_element_type = 'CLASS' THEN 1 END) as class_embeddings,
    COUNT(CASE WHEN ce.code_element_type = 'METHOD' THEN 1 END) as method_embeddings
FROM codebase_metadata c
LEFT JOIN code_files cf ON cf.codebase_id = c.id
LEFT JOIN code_classes cc ON cc.file_id = cf.id
LEFT JOIN code_embeddings ce ON ce.code_class_id = cc.id
WHERE c.id = 4
GROUP BY c.id, c.name;
