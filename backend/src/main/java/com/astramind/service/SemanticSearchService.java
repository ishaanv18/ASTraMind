package com.astramind.service;

import com.astramind.model.CodeEmbedding;
import com.astramind.repository.CodeEmbeddingRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class SemanticSearchService {

    @Autowired
    private LocalEmbeddingService localEmbeddingService;

    @Autowired
    private CodeEmbeddingRepository codeEmbeddingRepository;

    /**
     * Search code using natural language query
     * Uses cosine similarity to find most relevant code
     */
    public List<Map<String, Object>> searchByQuery(Long codebaseId, String query, String type, int limit) {
        try {
            System.out.println("Performing semantic search for query: " + query);

            // Generate embedding for the search query using local service
            float[] queryEmbedding = localEmbeddingService.generateEmbedding(query);

            if (queryEmbedding == null || queryEmbedding.length == 0) {
                System.err.println("Failed to generate embedding for query");
                return new ArrayList<>();
            }

            // Get all embeddings for the codebase
            List<CodeEmbedding> allEmbeddings = codeEmbeddingRepository
                    .findByCodeFile_Codebase_Id(codebaseId);

            System.out.println("Found " + allEmbeddings.size() + " embeddings to search");

            // Filter by type if specified
            if (type != null && !type.equals("ALL")) {
                int beforeFilter = allEmbeddings.size();
                String searchType = type.toUpperCase();
                allEmbeddings = allEmbeddings.stream()
                        .filter(e -> e.getCodeElementType() != null &&
                                e.getCodeElementType().toUpperCase().equals(searchType))
                        .toList();
                System.out.println("Filtered from " + beforeFilter + " to " + allEmbeddings.size()
                        + " embeddings for type: " + type);

                // Log the types we have
                if (allEmbeddings.isEmpty() && beforeFilter > 0) {
                    System.out.println("Available types in database:");
                    codeEmbeddingRepository.findByCodeFile_Codebase_Id(codebaseId).stream()
                            .map(CodeEmbedding::getCodeElementType)
                            .distinct()
                            .forEach(t -> System.out.println("  - " + t));
                }
            }

            // Calculate similarity scores
            List<Map<String, Object>> results = new ArrayList<>();
            for (CodeEmbedding embedding : allEmbeddings) {
                try {
                    float[] codeEmbedding = embedding.getEmbeddingVector();

                    if (codeEmbedding == null || codeEmbedding.length == 0) {
                        continue;
                    }

                    double similarity = cosineSimilarity(queryEmbedding, codeEmbedding);

                    // Only include results with meaningful similarity (> 0.1)
                    if (similarity > 0.1) {
                        Map<String, Object> result = new HashMap<>();
                        result.put("type", embedding.getCodeElementType());
                        result.put("similarity", similarity);
                        result.put("textContent", embedding.getTextContent());
                        result.put("elementName", embedding.getElementName());

                        // Add file information
                        if (embedding.getCodeFile() != null) {
                            result.put("fileName", getFileName(embedding.getCodeFile().getFilePath()));
                            result.put("filePath", embedding.getCodeFile().getFilePath());
                            result.put("fileId", embedding.getCodeFile().getId());
                        }

                        if (embedding.getCodeClass() != null) {
                            result.put("id", embedding.getCodeClass().getId());
                            result.put("name", embedding.getCodeClass().getName());
                            result.put("package", embedding.getCodeClass().getPackageName());
                            result.put("fullyQualifiedName", embedding.getCodeClass().getFullyQualifiedName());
                            result.put("startLine", embedding.getCodeClass().getStartLine());
                            result.put("endLine", embedding.getCodeClass().getEndLine());
                        } else if (embedding.getCodeMethod() != null) {
                            result.put("id", embedding.getCodeMethod().getId());
                            result.put("name", embedding.getCodeMethod().getName());
                            result.put("parameters", embedding.getCodeMethod().getParameters());
                            result.put("startLine", embedding.getCodeMethod().getStartLine());
                            result.put("endLine", embedding.getCodeMethod().getEndLine());

                            if (embedding.getCodeMethod().getCodeClass() != null) {
                                result.put("className", embedding.getCodeMethod().getCodeClass().getName());
                                result.put("package", embedding.getCodeMethod().getCodeClass().getPackageName());
                            }
                        }

                        results.add(result);
                    }
                } catch (Exception e) {
                    System.err.println("Error processing embedding: " + e.getMessage());
                }
            }

            // Sort by similarity (descending) and limit results
            results.sort((a, b) -> Double.compare((Double) b.get("similarity"), (Double) a.get("similarity")));

            return results.stream().limit(limit).toList();

        } catch (Exception e) {
            throw new RuntimeException("Failed to perform semantic search: " + e.getMessage(), e);
        }
    }

    /**
     * Extract filename from file path
     */
    private String getFileName(String filePath) {
        if (filePath == null) {
            return "";
        }
        int lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
        return lastSlash >= 0 ? filePath.substring(lastSlash + 1) : filePath;
    }

    /**
     * Calculate cosine similarity between two vectors
     */
    private double cosineSimilarity(float[] vectorA, float[] vectorB) {
        if (vectorA.length != vectorB.length) {
            throw new IllegalArgumentException("Vectors must have the same length");
        }

        double dotProduct = 0.0;
        double normA = 0.0;
        double normB = 0.0;

        for (int i = 0; i < vectorA.length; i++) {
            dotProduct += vectorA[i] * vectorB[i];
            normA += vectorA[i] * vectorA[i];
            normB += vectorB[i] * vectorB[i];
        }

        if (normA == 0.0 || normB == 0.0) {
            return 0.0;
        }

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * Find similar code to a given class or method
     */
    public List<Map<String, Object>> findSimilarCode(Long embeddingId, int limit) {
        try {
            Optional<CodeEmbedding> targetEmbedding = codeEmbeddingRepository.findById(embeddingId);
            if (targetEmbedding.isEmpty()) {
                throw new RuntimeException("Embedding not found");
            }

            float[] targetVector = targetEmbedding.get().getEmbeddingVector();
            List<CodeEmbedding> allEmbeddings = codeEmbeddingRepository.findAll();

            List<Map<String, Object>> results = new ArrayList<>();
            for (CodeEmbedding embedding : allEmbeddings) {
                if (embedding.getId().equals(embeddingId)) {
                    continue; // Skip the target itself
                }

                float[] codeEmbedding = embedding.getEmbeddingVector();
                double similarity = cosineSimilarity(targetVector, codeEmbedding);

                Map<String, Object> result = new HashMap<>();
                result.put("type", embedding.getEmbeddingType());
                result.put("similarity", similarity);
                result.put("textContent", embedding.getTextContent());

                if (embedding.getCodeClass() != null) {
                    result.put("id", embedding.getCodeClass().getId());
                    result.put("name", embedding.getCodeClass().getName());
                    result.put("package", embedding.getCodeClass().getPackageName());
                }

                results.add(result);
            }

            results.sort((a, b) -> Double.compare((Double) b.get("similarity"), (Double) a.get("similarity")));
            return results.stream().limit(limit).toList();

        } catch (Exception e) {
            throw new RuntimeException("Failed to find similar code: " + e.getMessage(), e);
        }
    }
}
