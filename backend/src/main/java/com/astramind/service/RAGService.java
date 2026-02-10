package com.astramind.service;

import com.astramind.model.*;
import com.astramind.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class RAGService {

    @Autowired
    private CodeClassRepository classRepository;

    @Autowired
    private CodeRelationshipRepository relationshipRepository;

    @Autowired
    private SemanticSearchService semanticSearchService;

    /**
     * Retrieve relevant context for a question
     */
    public Map<String, Object> retrieveContext(String question, String codebaseId, int maxClasses, int maxMethods) {
        Map<String, Object> context = new HashMap<>();

        try {
            // 1. Find relevant classes using embeddings
            List<Map<String, Object>> relevantClasses = findRelevantClasses(question, codebaseId, maxClasses);
            context.put("classes", relevantClasses);

            // 2. Find relevant methods using embeddings
            List<Map<String, Object>> relevantMethods = findRelevantMethods(question, codebaseId, maxMethods);
            context.put("methods", relevantMethods);

            // 3. Build dependency context for top classes
            if (!relevantClasses.isEmpty()) {
                String topClassId = (String) relevantClasses.get(0).get("id");
                Map<String, Object> dependencies = buildDependencyContext(topClassId);
                context.put("dependencies", dependencies);
            }

            // 4. Add metadata
            context.put("totalClasses", relevantClasses.size());
            context.put("totalMethods", relevantMethods.size());
            context.put("question", question);

        } catch (Exception e) {
            System.err.println("Error retrieving context: " + e.getMessage());
            context.put("error", e.getMessage());
        }

        return context;
    }

    /**
     * Find relevant classes using semantic search
     */
    public List<Map<String, Object>> findRelevantClasses(String query, String codebaseId, int limit) {
        try {
            System.out
                    .println("RAGService: Searching for classes with query: " + query + ", codebaseId: " + codebaseId);

            // Use semantic search service to find similar classes
            List<Map<String, Object>> results = semanticSearchService.searchByQuery(
                    codebaseId, query, "CLASS", limit);

            System.out.println("RAGService: Found " + results.size() + " classes");

            return results.stream()
                    .map(result -> {
                        Map<String, Object> classInfo = new HashMap<>();
                        classInfo.put("id", result.get("id"));
                        classInfo.put("name", result.get("name"));
                        classInfo.put("packageName", result.getOrDefault("package", ""));
                        classInfo.put("similarity", result.get("similarity"));
                        classInfo.put("type", "class");
                        return classInfo;
                    })
                    .collect(Collectors.toList());
        } catch (Exception e) {
            System.err.println("Error finding relevant classes: " + e.getMessage());
            e.printStackTrace();
            return new ArrayList<>();
        }
    }

    /**
     * Find relevant methods using semantic search
     */
    public List<Map<String, Object>> findRelevantMethods(String query, String codebaseId, int limit) {
        try {
            // Use semantic search service to find similar methods
            List<Map<String, Object>> results = semanticSearchService.searchByQuery(
                    codebaseId, query, "METHOD", limit);

            return results.stream()
                    .map(result -> {
                        Map<String, Object> methodInfo = new HashMap<>();
                        methodInfo.put("id", result.get("id"));
                        methodInfo.put("name", result.get("name"));
                        methodInfo.put("className", result.getOrDefault("className", ""));
                        methodInfo.put("similarity", result.get("similarity"));
                        methodInfo.put("type", "method");
                        return methodInfo;
                    })
                    .collect(Collectors.toList());
        } catch (Exception e) {
            System.err.println("Error finding relevant methods: " + e.getMessage());
            return new ArrayList<>();
        }
    }

    /**
     * Build dependency context for a class
     */
    public Map<String, Object> buildDependencyContext(String classId) {
        Map<String, Object> depContext = new HashMap<>();

        try {
            // Find relationships where this class is the source
            List<CodeRelationship> outgoing = relationshipRepository.findBySourceClassId(classId);

            // Find relationships where this class is the target
            List<CodeRelationship> incoming = relationshipRepository.findByTargetClassId(classId);

            depContext.put("dependencies", outgoing.size());
            depContext.put("dependents", incoming.size());

            // Group by relationship type
            Map<String, Long> outgoingByType = outgoing.stream()
                    .collect(Collectors.groupingBy(
                            CodeRelationship::getRelationshipType,
                            Collectors.counting()));

            depContext.put("outgoingByType", outgoingByType);

        } catch (Exception e) {
            System.err.println("Error building dependency context: " + e.getMessage());
        }

        return depContext;
    }

    /**
     * Format context as a string for LLM prompt
     */
    public String formatContextForPrompt(Map<String, Object> context) {
        StringBuilder formatted = new StringBuilder();

        // Format classes
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> classes = (List<Map<String, Object>>) context.get("classes");
        if (classes != null && !classes.isEmpty()) {
            formatted.append("=== Relevant Classes ===\n\n");
            for (Map<String, Object> cls : classes) {
                formatted.append(String.format("Class: %s\n", cls.get("name")));
                formatted.append(String.format("Package: %s\n", cls.get("packageName")));
                formatted.append(String.format("Relevance: %.2f%%\n\n",
                        ((Number) cls.get("similarity")).doubleValue() * 100));
            }
        }

        // Format methods
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> methods = (List<Map<String, Object>>) context.get("methods");
        if (methods != null && !methods.isEmpty()) {
            formatted.append("=== Relevant Methods ===\n\n");
            for (Map<String, Object> method : methods) {
                formatted.append(String.format("Method: %s\n", method.get("name")));
                formatted.append(String.format("Class: %s\n", method.get("className")));
                formatted.append(String.format("Relevance: %.2f%%\n\n",
                        ((Number) method.get("similarity")).doubleValue() * 100));
            }
        }

        // Format dependencies
        @SuppressWarnings("unchecked")
        Map<String, Object> dependencies = (Map<String, Object>) context.get("dependencies");
        if (dependencies != null && !dependencies.isEmpty()) {
            formatted.append("=== Dependencies ===\n\n");
            formatted.append(String.format("Outgoing dependencies: %s\n", dependencies.get("dependencies")));
            formatted.append(String.format("Incoming dependencies: %s\n\n", dependencies.get("dependents")));
        }

        return formatted.toString();
    }

    /**
     * Get full class details for context
     */
    public String getClassDetails(String classId) {
        try {
            Optional<CodeClass> classOpt = classRepository.findById(classId);
            if (classOpt.isPresent()) {
                CodeClass codeClass = classOpt.get();
                StringBuilder details = new StringBuilder();

                details.append(String.format("=== Class: %s ===\n", codeClass.getName()));
                details.append(String.format("Package: %s\n", codeClass.getPackageName()));
                details.append(String.format("Type: %s\n",
                        codeClass.getIsInterface() ? "Interface" : "Class"));

                if (codeClass.getExtendsClass() != null) {
                    details.append(String.format("Extends: %s\n", codeClass.getExtendsClass()));
                }

                details.append(String.format("\nMethods: %d\n",
                        codeClass.getMethods() != null ? codeClass.getMethods().size() : 0));
                details.append(String.format("Fields: %d\n\n",
                        codeClass.getFields() != null ? codeClass.getFields().size() : 0));

                return details.toString();
            }
        } catch (Exception e) {
            System.err.println("Error getting class details: " + e.getMessage());
        }

        return "";
    }

}
