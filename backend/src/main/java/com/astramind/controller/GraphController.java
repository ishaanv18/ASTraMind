package com.astramind.controller;

import com.astramind.service.DependencyGraphService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/graph")
public class GraphController {

    private static final Logger logger = LoggerFactory.getLogger(GraphController.class);

    @Autowired
    private DependencyGraphService graphService;

    /**
     * Get class dependency graph for a codebase
     */
    @GetMapping("/codebases/{id}/classes")
    public ResponseEntity<Map<String, Object>> getClassDependencyGraph(@PathVariable Long id) {
        logger.info("Fetching class dependency graph for codebase: {}", id);

        try {
            Map<String, Object> graph = graphService.getCodebaseGraph(id);
            return ResponseEntity.ok(graph);
        } catch (Exception e) {
            logger.error("Error building graph for codebase {}: {}", id, e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Get dependencies for a specific class
     */
    @GetMapping("/classes/{id}/dependencies")
    public ResponseEntity<?> getClassDependencies(@PathVariable Long id) {
        logger.info("Fetching dependencies for class: {}", id);

        try {
            var dependencies = graphService.getClassDependencies(id);
            return ResponseEntity.ok(dependencies);
        } catch (Exception e) {
            logger.error("Error fetching dependencies for class {}: {}", id, e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Get dependents (classes that depend on this class)
     */
    @GetMapping("/classes/{id}/dependents")
    public ResponseEntity<?> getClassDependents(@PathVariable Long id) {
        logger.info("Fetching dependents for class: {}", id);

        try {
            var dependents = graphService.getClassDependents(id);
            return ResponseEntity.ok(dependents);
        } catch (Exception e) {
            logger.error("Error fetching dependents for class {}: {}", id, e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }
}
