package com.astramind.controller;

import com.astramind.model.*;
import com.astramind.service.ASTParserService;
import com.astramind.service.CodeIngestionService;
import jakarta.servlet.http.HttpSession;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/codebases")
@Slf4j
public class CodeStructureController {

    @Autowired
    private ASTParserService astParserService;

    @Autowired
    private CodeIngestionService codeIngestionService;

    /**
     * Trigger AST parsing for a codebase
     */
    @PostMapping("/{id}/parse")
    public ResponseEntity<?> parseCodebase(@PathVariable Long id, HttpSession session) {
        User user = (User) session.getAttribute("user");
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        try {
            // Verify ownership
            CodebaseMetadata codebase = codeIngestionService.getCodebase(id);
            if (!codebase.getUser().getId().equals(user.getId())) {
                return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
            }

            // Trigger parsing in background
            new Thread(() -> {
                try {
                    astParserService.parseCodebase(id);
                    log.info("AST parsing completed for codebase: {}", id);
                } catch (Exception e) {
                    log.error("Error parsing codebase {}: {}", id, e.getMessage(), e);
                }
            }).start();

            return ResponseEntity.ok(Map.of(
                    "message", "AST parsing started",
                    "codebaseId", id));
        } catch (Exception e) {
            log.error("Error starting AST parsing: {}", e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of("error", "Failed to start parsing"));
        }
    }

    /**
     * Get code structure for a codebase
     */
    @GetMapping("/{id}/structure")
    public ResponseEntity<?> getCodeStructure(@PathVariable Long id, HttpSession session) {
        User user = (User) session.getAttribute("user");
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        try {
            // Verify ownership
            CodebaseMetadata codebase = codeIngestionService.getCodebase(id);
            if (!codebase.getUser().getId().equals(user.getId())) {
                return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
            }

            List<CodeClass> classes = astParserService.getCodebaseClasses(id);

            // Build structure response
            List<Map<String, Object>> structure = classes.stream()
                    .map(cls -> {
                        Map<String, Object> classData = new HashMap<>();
                        classData.put("id", cls.getId());
                        classData.put("name", cls.getName());
                        classData.put("packageName", cls.getPackageName());
                        classData.put("fullyQualifiedName", cls.getFullyQualifiedName());
                        classData.put("isInterface", cls.getIsInterface());
                        classData.put("isAbstract", cls.getIsAbstract());
                        classData.put("extendsClass", cls.getExtendsClass());
                        classData.put("startLine", cls.getStartLine());
                        classData.put("endLine", cls.getEndLine());
                        classData.put("fileId", cls.getFile().getId());
                        classData.put("filePath", cls.getFile().getFilePath());

                        // Add methods
                        List<Map<String, Object>> methods = cls.getMethods().stream()
                                .map(m -> {
                                    Map<String, Object> methodData = new HashMap<>();
                                    methodData.put("id", m.getId());
                                    methodData.put("name", m.getName());
                                    methodData.put("returnType", m.getReturnType());
                                    methodData.put("parameters", m.getParameters());
                                    methodData.put("isStatic", m.getIsStatic());
                                    methodData.put("isPublic", m.getIsPublic());
                                    methodData.put("startLine", m.getStartLine());
                                    methodData.put("endLine", m.getEndLine());
                                    return methodData;
                                })
                                .collect(Collectors.toList());
                        classData.put("methods", methods);

                        // Add fields
                        List<Map<String, Object>> fields = cls.getFields().stream()
                                .map(f -> {
                                    Map<String, Object> fieldData = new HashMap<>();
                                    fieldData.put("id", f.getId());
                                    fieldData.put("name", f.getName());
                                    fieldData.put("type", f.getType());
                                    fieldData.put("isStatic", f.getIsStatic());
                                    fieldData.put("isFinal", f.getIsFinal());
                                    fieldData.put("lineNumber", f.getLineNumber());
                                    return fieldData;
                                })
                                .collect(Collectors.toList());
                        classData.put("fields", fields);

                        return classData;
                    })
                    .collect(Collectors.toList());

            return ResponseEntity.ok(Map.of(
                    "classes", structure,
                    "totalClasses", classes.size()));
        } catch (Exception e) {
            log.error("Error fetching code structure: {}", e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of("error", "Failed to fetch code structure"));
        }
    }

    /**
     * Get classes for a codebase
     */
    @GetMapping("/{id}/classes")
    public ResponseEntity<?> getClasses(@PathVariable Long id, HttpSession session) {
        User user = (User) session.getAttribute("user");
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        try {
            CodebaseMetadata codebase = codeIngestionService.getCodebase(id);
            if (!codebase.getUser().getId().equals(user.getId())) {
                return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
            }

            List<CodeClass> classes = astParserService.getCodebaseClasses(id);
            return ResponseEntity.ok(classes);
        } catch (Exception e) {
            log.error("Error fetching classes: {}", e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of("error", "Failed to fetch classes"));
        }
    }
}
