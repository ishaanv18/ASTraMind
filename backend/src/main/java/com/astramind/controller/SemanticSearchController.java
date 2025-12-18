package com.astramind.controller;

import com.astramind.service.ChatService;
import com.astramind.service.SemanticSearchService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/search")
public class SemanticSearchController {

    @Autowired
    private SemanticSearchService semanticSearchService;

    @Autowired
    private ChatService chatService;

    /**
     * Semantic search endpoint
     */
    @PostMapping("/codebases/{id}/semantic")
    public ResponseEntity<Map<String, Object>> semanticSearch(
            @PathVariable Long id,
            @RequestBody Map<String, Object> request) {

        Map<String, Object> response = new HashMap<>();
        try {
            String query = (String) request.get("query");
            String type = (String) request.getOrDefault("type", "ALL");
            int limit = (int) request.getOrDefault("limit", 10);

            List<Map<String, Object>> results = semanticSearchService.searchByQuery(id, query, type, limit);

            response.put("success", true);
            response.put("results", results);
            response.put("count", results.size());
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }

    /**
     * Find similar code endpoint
     */
    @GetMapping("/embeddings/{id}/similar")
    public ResponseEntity<Map<String, Object>> findSimilar(
            @PathVariable Long id,
            @RequestParam(defaultValue = "5") int limit) {

        Map<String, Object> response = new HashMap<>();
        try {
            List<Map<String, Object>> results = semanticSearchService.findSimilarCode(id, limit);

            response.put("success", true);
            response.put("results", results);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }

    /**
     * Chat/Q&A endpoint
     */
    @PostMapping("/codebases/{id}/chat")
    public ResponseEntity<Map<String, Object>> chat(
            @PathVariable Long id,
            @RequestBody Map<String, String> request) {

        try {
            String message = request.get("message");
            String conversationId = request.get("conversationId");

            Map<String, Object> result = chatService.askQuestion(id, message, conversationId);
            return ResponseEntity.ok(result);

        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    /**
     * Get conversation history
     */
    @GetMapping("/conversations/{id}")
    public ResponseEntity<Map<String, Object>> getConversation(@PathVariable String id) {
        Map<String, Object> response = new HashMap<>();
        try {
            List<Map<String, String>> history = chatService.getConversationHistory(id);
            response.put("conversationId", id);
            response.put("history", history);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            response.put("error", e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }

    /**
     * Clear conversation
     */
    @DeleteMapping("/conversations/{id}")
    public ResponseEntity<Map<String, Object>> clearConversation(@PathVariable String id) {
        Map<String, Object> response = new HashMap<>();
        try {
            chatService.clearConversation(id);
            response.put("success", true);
            response.put("message", "Conversation cleared");
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }
}
