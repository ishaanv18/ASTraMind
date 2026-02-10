package com.astramind.service;

import com.astramind.model.CodeClass;
import com.astramind.model.CodeEmbedding;
import com.astramind.model.CodeMethod;
import com.astramind.model.CodeFile;
import com.astramind.repository.CodeClassRepository;
import com.astramind.repository.CodeEmbeddingRepository;
import com.astramind.repository.CodeFileRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class EmbeddingService {

    @Autowired
    private LocalEmbeddingService localEmbeddingService;

    @Autowired
    private CodeClassRepository codeClassRepository;

    @Autowired
    private CodeFileRepository codeFileRepository;

    @Autowired
    private CodeEmbeddingRepository codeEmbeddingRepository;

    /**
     * Delete all embeddings for a specific codebase
     */
    @Transactional
    public void deleteEmbeddingsForCodebase(String codebaseId) {
        System.out.println("🗑️  Deleting old embeddings for codebase " + codebaseId);

        // Get all files for this codebase, then get classes
        List<CodeFile> files = codeFileRepository.findByCodebaseId(codebaseId);
        int deletedCount = 0;

        for (CodeFile file : files) {
            List<CodeClass> classes = codeClassRepository.findByFileId(file.getId());
            for (CodeClass codeClass : classes) {
                codeEmbeddingRepository.deleteByCodeClassId(codeClass.getId());
                deletedCount++;
            }
        }

        System.out.println("✅ Deleted embeddings for " + deletedCount + " classes");
    }

    /**
     * Generate embeddings for all classes in a codebase
     */
    @Transactional
    public int generateClassEmbeddings(String codebaseId) {
        // First, delete all existing CLASS embeddings for this codebase
        System.out.println("🗑️  Clearing old CLASS embeddings...");
        List<CodeFile> files = codeFileRepository.findByCodebaseId(codebaseId);
        List<CodeClass> allClasses = new ArrayList<>();
        for (CodeFile file : files) {
            allClasses.addAll(codeClassRepository.findByFileId(file.getId()));
        }

        for (CodeClass cls : allClasses) {
            // Delete only CLASS type embeddings
            List<CodeEmbedding> classEmbeddings = codeEmbeddingRepository.findByCodeClassId(cls.getId())
                    .stream()
                    .filter(e -> "CLASS".equals(e.getCodeElementType()))
                    .collect(Collectors.toList());
            codeEmbeddingRepository.deleteAll(classEmbeddings);
        }
        System.out.println("✅ Cleared old CLASS embeddings");

        List<CodeClass> classes = allClasses;
        int count = 0;
        int errors = 0;
        int skipped = 0;

        System.out.println("📚 Starting CLASS embedding generation for " + classes.size() + " classes");

        for (CodeClass codeClass : classes) {
            try {
                String textContent = buildClassText(codeClass);

                if (textContent == null || textContent.trim().isEmpty()) {
                    skipped++;
                    System.out.println("⏭️  Skipping class " + codeClass.getName() + " - empty content");
                    continue;
                }

                System.out.println("🔄 Generating embedding for class: " + codeClass.getName());
                float[] embedding = localEmbeddingService.generateEmbedding(textContent);

                if (embedding != null && embedding.length > 0) {
                    CodeEmbedding codeEmbedding = new CodeEmbedding();
                    codeEmbedding.setCodeClassId(codeClass.getId());
                    codeEmbedding.setCodeFileId(codeClass.getFileId());
                    codeEmbedding.setCodeElementType("CLASS");
                    codeEmbedding.setElementName(codeClass.getName());
                    codeEmbedding.setEmbeddingType("CLASS");
                    codeEmbedding.setEmbeddingVector(embedding);
                    codeEmbedding.setTextContent(
                            textContent.length() > 1000 ? textContent.substring(0, 1000) + "..." : textContent);

                    codeEmbeddingRepository.save(codeEmbedding);
                    count++;

                    // Log progress
                    if (count % 10 == 0) {
                        System.out.println("✅ Generated embeddings for " + count + " classes");
                    }
                } else {
                    skipped++;
                    System.out.println("⏭️  Skipping class " + codeClass.getName() + " - null or empty embedding");
                }

            } catch (Exception e) {
                errors++;
                System.err.println(
                        "❌ Failed to generate embedding for class: " + codeClass.getName() + " - " + e.getMessage());
                if (errors < 5) { // Only print stack trace for first few errors
                    e.printStackTrace();
                }
            }
        }

        System.out.println(
                "📊 CLASS Embedding Summary: Generated=" + count + ", Skipped=" + skipped + ", Errors=" + errors);
        return count;
    }

    /**
     * Generate embeddings for all methods in a codebase
     */
    @Transactional
    public int generateMethodEmbeddings(String codebaseId) {
        // First, delete all existing METHOD embeddings for this codebase
        System.out.println("🗑️  Clearing old METHOD embeddings...");
        List<CodeFile> files = codeFileRepository.findByCodebaseId(codebaseId);
        List<CodeClass> allClasses = new ArrayList<>();
        for (CodeFile file : files) {
            allClasses.addAll(codeClassRepository.findByFileId(file.getId()));
        }

        for (CodeClass cls : allClasses) {
            // Delete only METHOD type embeddings
            List<CodeEmbedding> methodEmbeddings = codeEmbeddingRepository.findByCodeClassId(cls.getId())
                    .stream()
                    .filter(e -> "METHOD".equals(e.getCodeElementType()))
                    .collect(Collectors.toList());
            codeEmbeddingRepository.deleteAll(methodEmbeddings);
        }
        System.out.println("✅ Cleared old METHOD embeddings");

        List<CodeClass> classes = allClasses;
        int count = 0;
        int errors = 0;

        for (CodeClass codeClass : classes) {
            List<CodeMethod> methods = codeClass.getMethods() != null ? codeClass.getMethods() : new ArrayList<>();
            String className = codeClass.getName(); // Get the class name once in the outer loop

            for (CodeMethod method : methods) {
                try {
                    String textContent = buildMethodText(method, className); // Pass className

                    if (textContent == null || textContent.trim().isEmpty()) {
                        continue;
                    }

                    float[] embedding = localEmbeddingService.generateEmbedding(textContent);

                    if (embedding != null && embedding.length > 0) {
                        CodeEmbedding codeEmbedding = new CodeEmbedding();
                        codeEmbedding.setCodeClassId(codeClass.getId());
                        codeEmbedding.setCodeFileId(codeClass.getFileId());
                        codeEmbedding.setCodeElementType("METHOD");
                        codeEmbedding.setElementName(method.getName());
                        codeEmbedding.setEmbeddingType("METHOD");
                        codeEmbedding.setEmbeddingVector(embedding);
                        codeEmbedding.setTextContent(
                                textContent.length() > 1000 ? textContent.substring(0, 1000) + "..." : textContent);

                        codeEmbeddingRepository.save(codeEmbedding);
                        count++;

                        if (count % 50 == 0) {
                            System.out.println("Generated embeddings for " + count + " methods");
                        }
                    }

                } catch (Exception e) {
                    errors++;
                    System.err.println(
                            "Failed to generate embedding for method: " + method.getName() + " - " + e.getMessage());
                    if (errors < 5) {
                        e.printStackTrace();
                    }
                }
            }
        }

        System.out.println("Generated " + count + " method embeddings");
        return count;
    }

    /**
     * Generate all embeddings for a codebase (classes and methods)
     */
    public void generateAllEmbeddings(String codebaseId) {
        System.out.println("=== STARTING EMBEDDING GENERATION FOR CODEBASE " + codebaseId + " ===");

        try {
            System.out.println("Step 1: Generating CLASS embeddings...");
            int classCount = generateClassEmbeddings(codebaseId);
            System.out.println("✅ Generated " + classCount + " class embeddings");
        } catch (Exception e) {
            System.err.println("❌ ERROR generating class embeddings: " + e.getMessage());
            e.printStackTrace();
        }

        try {
            System.out.println("Step 2: Generating METHOD embeddings...");
            int methodCount = generateMethodEmbeddings(codebaseId);
            System.out.println("✅ Generated " + methodCount + " method embeddings");
        } catch (Exception e) {
            System.err.println("❌ ERROR generating method embeddings: " + e.getMessage());
            e.printStackTrace();
        }

        System.out.println("=== EMBEDDING GENERATION COMPLETE ===");
    }

    /**
     * Update embedding for a single class
     */
    @Transactional
    public void updateClassEmbedding(CodeClass codeClass) {
        try {
            // Delete existing embedding
            List<CodeEmbedding> existing = codeEmbeddingRepository.findByCodeClassId(codeClass.getId());
            codeEmbeddingRepository.deleteAll(existing);

            // Generate new embedding
            String textContent = buildClassText(codeClass);
            float[] embedding = localEmbeddingService.generateEmbedding(textContent);

            CodeEmbedding codeEmbedding = new CodeEmbedding();
            codeEmbedding.setCodeClassId(codeClass.getId());
            codeEmbedding.setCodeFileId(codeClass.getFileId());
            codeEmbedding.setCodeElementType("CLASS");
            codeEmbedding.setElementName(codeClass.getName());
            codeEmbedding.setEmbeddingVector(embedding);
            codeEmbedding.setTextContent(textContent);

            codeEmbeddingRepository.save(codeEmbedding);

        } catch (Exception e) {
            throw new RuntimeException("Failed to update class embedding: " + e.getMessage(), e);
        }
    }

    /**
     * Update embedding for a single method (methods are now embedded, so this
     * updates via the class)
     */
    @Transactional
    public void updateMethodEmbedding(CodeMethod method, String classId, String className) {
        try {
            // Note: Methods are embedded, so we can't query by method ID directly
            // We need to delete embeddings by element name and class ID
            List<CodeEmbedding> existing = codeEmbeddingRepository.findByCodeClassId(classId)
                    .stream()
                    .filter(e -> "METHOD".equals(e.getCodeElementType()) && method.getName().equals(e.getElementName()))
                    .collect(Collectors.toList());
            codeEmbeddingRepository.deleteAll(existing);

            // Generate new embedding
            String textContent = buildMethodText(method, className);
            float[] embedding = localEmbeddingService.generateEmbedding(textContent);

            CodeEmbedding codeEmbedding = new CodeEmbedding();
            codeEmbedding.setCodeClassId(classId);
            codeEmbedding.setCodeElementType("METHOD");
            codeEmbedding.setElementName(method.getName());
            codeEmbedding.setEmbeddingVector(embedding);
            codeEmbedding.setTextContent(textContent);

            codeEmbeddingRepository.save(codeEmbedding);

        } catch (Exception e) {
            throw new RuntimeException("Failed to update method embedding: " + e.getMessage(), e);
        }
    }

    /**
     * Build text representation of a class for embedding
     */
    private String buildClassText(CodeClass codeClass) {
        StringBuilder sb = new StringBuilder();

        sb.append("Class: ").append(codeClass.getName()).append("\n");
        sb.append("Package: ").append(codeClass.getPackageName()).append("\n");
        sb.append("Fully Qualified Name: ").append(codeClass.getFullyQualifiedName()).append("\n");

        // Add methods (now embedded in CodeClass)
        List<CodeMethod> methods = codeClass.getMethods() != null ? codeClass.getMethods() : new ArrayList<>();
        if (!methods.isEmpty()) {
            sb.append("Methods: ");
            String methodNames = methods.stream()
                    .map(CodeMethod::getName)
                    .collect(Collectors.joining(", "));
            sb.append(methodNames).append("\n");
        }

        // Add fields - wrapped in try-catch to handle lazy loading issues
        try {
            if (codeClass.getFields() != null && !codeClass.getFields().isEmpty()) {
                sb.append("Fields: ");
                String fieldNames = codeClass.getFields().stream()
                        .map(field -> field.getName() + ": " + field.getType())
                        .collect(Collectors.joining(", "));
                sb.append(fieldNames).append("\n");
            }
        } catch (Exception e) {
            // Log but don't fail - fields are optional for embedding
            System.out.println("⚠️  Could not access fields for class " + codeClass.getName() + ": " + e.getMessage());
        }

        // Add extends class if exists
        if (codeClass.getExtendsClass() != null && !codeClass.getExtendsClass().isEmpty()) {
            sb.append("Extends: ").append(codeClass.getExtendsClass()).append("\n");
        }

        return sb.toString();
    }

    /**
     * Build text representation of a method for embedding
     */
    private String buildMethodText(CodeMethod method, String className) {
        StringBuilder sb = new StringBuilder();

        sb.append("Method: ").append(method.getName()).append("\n");
        sb.append("Class: ").append(className).append("\n");

        if (method.getParameters() != null && !method.getParameters().isEmpty()) {
            sb.append("Parameters: ").append(method.getParameters()).append("\n");
        }

        if (method.getReturnType() != null && !method.getReturnType().isEmpty()) {
            sb.append("Return Type: ").append(method.getReturnType()).append("\n");
        }

        return sb.toString();
    }

    /**
     * Get embedding statistics for a codebase
     */
    public long getEmbeddingCount(String codebaseId) {
        // Count embeddings by iterating through files
        List<CodeFile> files = codeFileRepository.findByCodebaseId(codebaseId);
        long count = 0;
        for (CodeFile file : files) {
            count += codeEmbeddingRepository.countByCodeFileId(file.getId());
        }
        return count;
    }

    public long getClassEmbeddingCount(String codebaseId) {
        List<CodeFile> files = codeFileRepository.findByCodebaseId(codebaseId);
        long count = 0;
        for (CodeFile file : files) {
            count += codeEmbeddingRepository.findByCodeFileId(file.getId())
                    .stream()
                    .filter(e -> "CLASS".equals(e.getCodeElementType()))
                    .count();
        }
        return count;
    }

    public long getMethodEmbeddingCount(String codebaseId) {
        List<CodeFile> files = codeFileRepository.findByCodebaseId(codebaseId);
        long count = 0;
        for (CodeFile file : files) {
            count += codeEmbeddingRepository.findByCodeFileId(file.getId())
                    .stream()
                    .filter(e -> "METHOD".equals(e.getCodeElementType()))
                    .count();
        }
        return count;
    }
}
