package com.astramind.controller;

import com.astramind.service.SemanticSearchService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/search")
public class SearchController {

    @Autowired
    private SemanticSearchService semanticSearchService;

    /**
     * Perform semantic search on a codebase
     * 
     * @param codebaseId ID of the codebase to search
     * @param query      Natural language search query
     * @param type       Filter by type: CLASS, METHOD, or ALL (default: ALL)
     * @param limit      Maximum number of results (default: 20)
     * @return List of search results ranked by similarity
     */
    @PostMapping("/semantic")
    public ResponseEntity<Map<String, Object>> semanticSearch(
            @RequestParam Long codebaseId,
            @RequestParam String query,
            @RequestParam(defaultValue = "ALL") String type,
            @RequestParam(defaultValue = "20") int limit) {

        try {
            System.out.println("Semantic search request - Codebase: " + codebaseId + ", Query: " + query);

            List<Map<String, Object>> results = semanticSearchService.searchByQuery(
                    codebaseId, query, type, limit);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "query", query,
                    "resultCount", results.size(),
                    "results", results));
        } catch (Exception e) {
            System.err.println("Search error: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of(
                    "success", false,
                    "error", e.getMessage()));
        }
    }

    /**
     * Find similar code to a given embedding
     * 
     * @param embeddingId ID of the embedding to find similar code for
     * @param limit       Maximum number of results (default: 10)
     * @return List of similar code ranked by similarity
     */
    @GetMapping("/similar/{embeddingId}")
    public ResponseEntity<Map<String, Object>> findSimilar(
            @PathVariable Long embeddingId,
            @RequestParam(defaultValue = "10") int limit) {

        try {
            List<Map<String, Object>> results = semanticSearchService.findSimilarCode(
                    embeddingId, limit);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "resultCount", results.size(),
                    "results", results));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                    "success", false,
                    "error", e.getMessage()));
        }
    }
}
