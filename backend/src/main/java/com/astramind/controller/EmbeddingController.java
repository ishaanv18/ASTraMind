package com.astramind.controller;

import com.astramind.service.EmbeddingService;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/embeddings")
public class EmbeddingController {

    @Autowired
    private EmbeddingService embeddingService;

    /**
     * Delete all embeddings for a codebase
     */
    @DeleteMapping("/codebases/{id}")
    public ResponseEntity<Map<String, Object>> deleteEmbeddings(@PathVariable String id) {
        Map<String, Object> response = new HashMap<>();
        try {
            embeddingService.deleteEmbeddingsForCodebase(id);
            response.put("success", true);
            response.put("message", "All embeddings deleted for codebase " + id);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }

    /**
     * Generate embeddings for all classes in a codebase
     */
    @PostMapping("/codebases/{id}/classes")
    public ResponseEntity<Map<String, Object>> generateClassEmbeddings(@PathVariable String id) {
        Map<String, Object> response = new HashMap<>();
        try {
            int count = embeddingService.generateClassEmbeddings(id);
            response.put("success", true);
            response.put("count", count);
            response.put("message", "Generated embeddings for " + count + " classes");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }

    /**
     * Generate embeddings for all methods in a codebase
     */
    @PostMapping("/codebases/{id}/methods")
    public ResponseEntity<Map<String, Object>> generateMethodEmbeddings(@PathVariable String id) {
        Map<String, Object> response = new HashMap<>();
        try {
            int count = embeddingService.generateMethodEmbeddings(id);
            response.put("success", true);
            response.put("count", count);
            response.put("message", "Generated embeddings for " + count + " methods");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }

    /**
     * Generate all embeddings (classes and methods) for a codebase
     */
    @PostMapping("/codebases/{id}/generate")
    public ResponseEntity<Map<String, Object>> generateAllEmbeddings(@PathVariable String id) {
        Map<String, Object> response = new HashMap<>();
        try {
            // Run synchronously for debugging
            embeddingService.generateAllEmbeddings(id);

            response.put("success", true);
            response.put("message", "Embedding generation completed");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }

    /**
     * Get embedding statistics for a codebase
     */
    @GetMapping("/codebases/{id}/stats")
    public ResponseEntity<Map<String, Object>> getEmbeddingStats(@PathVariable String id) {
        Map<String, Object> response = new HashMap<>();
        try {
            long count = embeddingService.getEmbeddingCount(id);
            long classCount = embeddingService.getClassEmbeddingCount(id);
            long methodCount = embeddingService.getMethodEmbeddingCount(id);

            response.put("codebaseId", id);
            response.put("embeddingCount", count);
            response.put("classCount", classCount);
            response.put("methodCount", methodCount);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            response.put("error", e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }

}
