package com.astramind.controller;

import com.astramind.service.EmbeddingService;
import com.astramind.service.GeminiService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/embeddings")
@CrossOrigin(origins = { "http://localhost:3000", "http://localhost:5173" })
public class EmbeddingController {

    @Autowired
    private EmbeddingService embeddingService;

    @Autowired
    private GeminiService geminiService;

    /**
     * Delete all embeddings for a codebase
     */
    @DeleteMapping("/codebases/{id}")
    public ResponseEntity<Map<String, Object>> deleteEmbeddings(@PathVariable Long id) {
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
     * Test Gemini API connectivity
     */
    @GetMapping("/test")
    public ResponseEntity<Map<String, Object>> testGeminiConnection() {
        Map<String, Object> response = new HashMap<>();
        try {
            boolean connected = geminiService.testConnection();
            response.put("connected", connected);
            response.put("message", connected ? "Gemini API is working!" : "Failed to connect to Gemini API");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            response.put("connected", false);
            response.put("error", e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }

    /**
     * Generate embeddings for all classes in a codebase
     */
    @PostMapping("/codebases/{id}/classes")
    public ResponseEntity<Map<String, Object>> generateClassEmbeddings(@PathVariable Long id) {
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
    public ResponseEntity<Map<String, Object>> generateMethodEmbeddings(@PathVariable Long id) {
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
    public ResponseEntity<Map<String, Object>> generateAllEmbeddings(@PathVariable Long id) {
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
    public ResponseEntity<Map<String, Object>> getEmbeddingStats(@PathVariable Long id) {
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

    /**
     * Test embedding generation with a sample text
     */
    @PostMapping("/test-embedding")
    public ResponseEntity<Map<String, Object>> testEmbedding(@RequestBody Map<String, String> request) {
        Map<String, Object> response = new HashMap<>();
        try {
            String text = request.get("text");
            if (text == null || text.isEmpty()) {
                response.put("error", "Text is required");
                return ResponseEntity.badRequest().body(response);
            }

            float[] embedding = geminiService.generateEmbedding(text);
            response.put("success", true);
            response.put("dimensions", embedding.length);
            response.put("sample", new float[] { embedding[0], embedding[1], embedding[2] });
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }
}
