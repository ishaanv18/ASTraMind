package com.astramind.controller;

import com.astramind.dto.IngestRepositoryRequest;
import com.astramind.model.CodebaseMetadata;
import com.astramind.model.User;
import com.astramind.service.CodeIngestionService;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;

@RestController
@RequestMapping("/api/codebases")
@Slf4j
public class CodebaseController {

    @Autowired
    private CodeIngestionService codeIngestionService;

    /**
     * Start ingestion of a GitHub repository
     */
    @PostMapping("/ingest")
    public ResponseEntity<?> ingestRepository(@RequestBody IngestRepositoryRequest request, HttpSession session) {
        User user = (User) session.getAttribute("user");
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        try {
            // Start async ingestion
            codeIngestionService.ingestRepository(user.getId(), request.getOwner(), request.getRepo());

            return ResponseEntity.ok(Map.of(
                    "message", "Repository ingestion started",
                    "repository", request.getOwner() + "/" + request.getRepo()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Get all codebases for the authenticated user
     */
    @GetMapping
    public ResponseEntity<?> getUserCodebases(HttpSession session) {
        User user = (User) session.getAttribute("user");
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        try {
            List<CodebaseMetadata> codebases = codeIngestionService.getUserCodebases(user.getId());
            return ResponseEntity.ok(codebases);
        } catch (Exception e) {
            log.error("Error fetching codebases for user {}: {}", user.getId(), e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of("error", "Failed to load codebases"));
        }
    }

    /**
     * Get codebase details by ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getCodebase(@PathVariable Long id, HttpSession session) {
        User user = (User) session.getAttribute("user");
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        try {
            CodebaseMetadata codebase = codeIngestionService.getCodebase(id);

            // Check if user owns this codebase
            if (!codebase.getUser().getId().equals(user.getId())) {
                return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
            }

            return ResponseEntity.ok(codebase);
        } catch (Exception e) {
            return ResponseEntity.status(404).body(Map.of("error", "Codebase not found"));
        }
    }

    /**
     * Get codebase processing status
     */
    @GetMapping("/{id}/status")
    public ResponseEntity<?> getCodebaseStatus(@PathVariable Long id, HttpSession session) {
        User user = (User) session.getAttribute("user");
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        try {
            CodebaseMetadata codebase = codeIngestionService.getCodebase(id);

            // Check if user owns this codebase
            if (!codebase.getUser().getId().equals(user.getId())) {
                return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
            }

            Map<String, Object> status = new HashMap<>();
            status.put("id", codebase.getId());
            status.put("name", codebase.getName());
            status.put("status", codebase.getStatus());
            status.put("fileCount", codebase.getFileCount());
            status.put("errorMessage", codebase.getErrorMessage());

            return ResponseEntity.ok(status);
        } catch (Exception e) {
            return ResponseEntity.status(404).body(Map.of("error", "Codebase not found"));
        }
    }

    /**
     * Get file tree for a codebase
     */
    @GetMapping("/{id}/files")
    public ResponseEntity<?> getCodebaseFiles(@PathVariable Long id, HttpSession session) {
        User user = (User) session.getAttribute("user");
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        try {
            CodebaseMetadata codebase = codeIngestionService.getCodebase(id);

            // Check if user owns this codebase
            if (!codebase.getUser().getId().equals(user.getId())) {
                return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
            }

            List<Map<String, Object>> files = codeIngestionService.getCodebaseFiles(id);
            return ResponseEntity.ok(files);
        } catch (Exception e) {
            return ResponseEntity.status(404).body(Map.of("error", "Codebase not found"));
        }
    }

    /**
     * Get specific file content
     */
    @GetMapping("/{id}/files/{fileId}")
    public ResponseEntity<?> getFileContent(@PathVariable Long id, @PathVariable Long fileId, HttpSession session) {
        User user = (User) session.getAttribute("user");
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        try {
            CodebaseMetadata codebase = codeIngestionService.getCodebase(id);

            // Check if user owns this codebase
            if (!codebase.getUser().getId().equals(user.getId())) {
                return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
            }

            Map<String, Object> fileContent = codeIngestionService.getFileContent(fileId, id);
            return ResponseEntity.ok(fileContent);
        } catch (Exception e) {
            return ResponseEntity.status(404).body(Map.of("error", "File not found"));
        }
    }

    /**
     * Delete a codebase
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteCodebase(@PathVariable Long id, HttpSession session) {
        User user = (User) session.getAttribute("user");
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        try {
            CodebaseMetadata codebase = codeIngestionService.getCodebase(id);

            // Check if user owns this codebase
            if (!codebase.getUser().getId().equals(user.getId())) {
                return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
            }

            codeIngestionService.deleteCodebase(id);
            return ResponseEntity.ok(Map.of("message", "Codebase deleted successfully"));
        } catch (Exception e) {
            return ResponseEntity.status(404).body(Map.of("error", "Codebase not found"));
        }
    }
}
