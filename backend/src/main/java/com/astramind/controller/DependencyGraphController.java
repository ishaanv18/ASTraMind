package com.astramind.controller;

import com.astramind.model.*;
import com.astramind.service.DependencyGraphService;
import com.astramind.service.CodeIngestionService;
import jakarta.servlet.http.HttpSession;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/codebases")
@Slf4j
public class DependencyGraphController {

    @Autowired
    private DependencyGraphService graphService;

    @Autowired
    private CodeIngestionService codeIngestionService;

    /**
     * Get dependency graph for a codebase
     */
    @GetMapping("/{id}/graph")
    public ResponseEntity<?> getCodebaseGraph(@PathVariable String id, HttpSession session) {
        User user = (User) session.getAttribute("user");
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        try {
            // Verify ownership
            CodebaseMetadata codebase = codeIngestionService.getCodebase(id);
            if (!codebase.getUserId().equals(user.getId())) {
                return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
            }

            Map<String, Object> graph = graphService.getCodebaseGraph(id);
            return ResponseEntity.ok(graph);
        } catch (Exception e) {
            log.error("Error fetching dependency graph: {}", e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of("error", "Failed to fetch dependency graph"));
        }
    }

    /**
     * Get dependencies for a specific class
     */
    @GetMapping("/classes/{classId}/dependencies")
    public ResponseEntity<?> getClassDependencies(@PathVariable String classId, HttpSession session) {
        User user = (User) session.getAttribute("user");
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        try {
            List<CodeRelationship> dependencies = graphService.getClassDependencies(classId);
            return ResponseEntity.ok(dependencies);
        } catch (Exception e) {
            log.error("Error fetching class dependencies: {}", e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of("error", "Failed to fetch dependencies"));
        }
    }

    /**
     * Get dependents (classes that depend on this class)
     */
    @GetMapping("/classes/{classId}/dependents")
    public ResponseEntity<?> getClassDependents(@PathVariable String classId, HttpSession session) {
        User user = (User) session.getAttribute("user");
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        try {
            List<CodeRelationship> dependents = graphService.getClassDependents(classId);
            return ResponseEntity.ok(dependents);
        } catch (Exception e) {
            log.error("Error fetching class dependents: {}", e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of("error", "Failed to fetch dependents"));
        }
    }
}
