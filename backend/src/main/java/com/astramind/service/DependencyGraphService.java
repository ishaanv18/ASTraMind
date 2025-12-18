package com.astramind.service;

import com.astramind.model.*;
import com.astramind.repository.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
public class DependencyGraphService {

    @Autowired
    private CodeRelationshipRepository relationshipRepository;

    @Autowired
    private CodeClassRepository classRepository;

    /**
     * Get dependency graph data for a codebase
     */
    public Map<String, Object> getCodebaseGraph(Long codebaseId) {
        log.info("Building dependency graph for codebase: {}", codebaseId);

        List<CodeClass> classes = classRepository.findByFile_Codebase_Id(codebaseId);
        List<CodeRelationship> relationships = relationshipRepository.findByCodebaseId(codebaseId);

        // Build nodes
        List<Map<String, Object>> nodes = classes.stream()
                .map(this::buildNode)
                .collect(Collectors.toList());

        // Build edges
        List<Map<String, Object>> edges = relationships.stream()
                .map(this::buildEdge)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        Map<String, Object> graph = new HashMap<>();
        graph.put("nodes", nodes);
        graph.put("edges", edges);
        graph.put("stats", buildStats(classes, relationships));

        log.info("Graph built: {} nodes, {} edges", nodes.size(), edges.size());
        return graph;
    }

    /**
     * Get dependencies for a specific class
     */
    public List<CodeRelationship> getClassDependencies(Long classId) {
        return relationshipRepository.findBySourceClass_Id(classId);
    }

    /**
     * Get dependents (classes that depend on this class)
     */
    public List<CodeRelationship> getClassDependents(Long classId) {
        return relationshipRepository.findByTargetClassId(classId);
    }

    /**
     * Build a node for the graph
     */
    private Map<String, Object> buildNode(CodeClass codeClass) {
        Map<String, Object> node = new HashMap<>();
        node.put("id", "class-" + codeClass.getId());
        node.put("label", codeClass.getName());
        node.put("package", codeClass.getPackageName());
        node.put("fullyQualifiedName", codeClass.getFullyQualifiedName());
        node.put("isInterface", codeClass.getIsInterface());
        node.put("methodCount", codeClass.getMethods() != null ? codeClass.getMethods().size() : 0);
        node.put("fieldCount", codeClass.getFields() != null ? codeClass.getFields().size() : 0);

        // Color by package
        node.put("color", getColorForPackage(codeClass.getPackageName()));

        return node;
    }

    /**
     * Build an edge for the graph
     */
    private Map<String, Object> buildEdge(CodeRelationship relationship) {
        if (relationship.getSourceClass() == null) {
            return null;
        }

        Map<String, Object> edge = new HashMap<>();
        edge.put("id", "rel-" + relationship.getId());
        edge.put("source", "class-" + relationship.getSourceClass().getId());

        // For target, we need to find the class by name if targetClassId is null
        if (relationship.getTargetClassId() != null) {
            edge.put("target", "class-" + relationship.getTargetClassId());
        } else {
            // Use target class name as identifier
            edge.put("target", "external-" + relationship.getTargetClassName());
            edge.put("isExternal", true);
        }

        edge.put("type", relationship.getRelationshipType());
        edge.put("label", relationship.getRelationshipType().toLowerCase());
        edge.put("color", getColorForRelationType(relationship.getRelationshipType()));

        return edge;
    }

    /**
     * Build statistics for the graph
     */
    private Map<String, Object> buildStats(List<CodeClass> classes, List<CodeRelationship> relationships) {
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalClasses", classes.size());
        stats.put("totalRelationships", relationships.size());

        // Count by relationship type
        Map<String, Long> byType = relationships.stream()
                .collect(Collectors.groupingBy(
                        CodeRelationship::getRelationshipType,
                        Collectors.counting()));
        stats.put("byType", byType);

        return stats;
    }

    /**
     * Get color for package (consistent hashing)
     */
    private String getColorForPackage(String packageName) {
        if (packageName == null)
            return "#6b7280";

        int hash = packageName.hashCode();
        String[] colors = {
                "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b",
                "#10b981", "#3b82f6", "#14b8a6", "#f97316"
        };
        return colors[Math.abs(hash) % colors.length];
    }

    /**
     * Get color for relationship type
     */
    private String getColorForRelationType(String type) {
        return switch (type) {
            case "IMPORTS" -> "#3b82f6"; // Blue
            case "EXTENDS" -> "#10b981"; // Green
            case "IMPLEMENTS" -> "#8b5cf6"; // Purple
            case "USES" -> "#f59e0b"; // Orange
            default -> "#6b7280"; // Gray
        };
    }
}
