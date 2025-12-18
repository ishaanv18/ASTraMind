package com.astramind.controller;

import com.astramind.service.ai.AIProvider;
import com.astramind.service.ai.AIServiceFactory;
import com.astramind.service.RAGService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/ai")
public class AIAssistantController {

    @Autowired
    private AIServiceFactory aiServiceFactory;

    @Autowired
    private RAGService ragService;

    /**
     * Ask a question about the codebase
     */
    @PostMapping("/ask")
    public ResponseEntity<Map<String, Object>> askQuestion(@RequestBody Map<String, Object> request) {
        try {
            String question = (String) request.get("question");
            Long codebaseId = ((Number) request.get("codebaseId")).longValue();

            // Retrieve relevant context using RAG
            Map<String, Object> context = ragService.retrieveContext(question, codebaseId, 5, 5);

            // Format context for prompt
            String formattedContext = ragService.formatContextForPrompt(context);

            // Generate response using AI provider (Ollama or Groq based on config)
            AIProvider aiProvider = aiServiceFactory.getProvider();
            String systemPrompt = "You are AstraMind, a senior software engineer AI assistant. You analyze Java codebases and provide expert insights. Be concise, accurate, and cite specific classes or methods when relevant.";
            String answer = aiProvider.generateResponse(systemPrompt,
                    "Context:\n" + formattedContext + "\n\nQuestion: " + question);

            // Build response
            Map<String, Object> response = new HashMap<>();
            response.put("answer", answer);
            response.put("context", context);
            response.put("success", true);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("error", e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    /**
     * Explain a specific class
     */
    @PostMapping("/explain-class/{classId}")
    public ResponseEntity<Map<String, Object>> explainClass(@PathVariable Long classId) {
        try {
            // Get class details
            String classDetails = ragService.getClassDetails(classId);

            // Build dependency context
            Map<String, Object> depContext = ragService.buildDependencyContext(classId);
            String depInfo = String.format("Dependencies: %s, Dependents: %s",
                    depContext.get("dependencies"), depContext.get("dependents"));

            // Generate explanation
            AIProvider aiProvider = aiServiceFactory.getProvider();
            String systemPrompt = "You are AstraMind, a code analysis expert. Explain classes thoroughly with design patterns and improvement suggestions.";
            String answer = aiProvider.generateResponse(systemPrompt,
                    "Explain this class:\n" + classDetails + "\n" + depInfo);

            Map<String, Object> response = new HashMap<>();
            response.put("answer", answer);
            response.put("classDetails", classDetails);
            response.put("dependencies", depContext);
            response.put("success", true);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("error", e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    /**
     * Analyze a specific method
     */
    @PostMapping("/analyze-method/{methodId}")
    public ResponseEntity<Map<String, Object>> analyzeMethod(@PathVariable Long methodId) {
        try {
            // Get method details
            String methodDetails = ragService.getMethodDetails(methodId);

            // Generate analysis
            AIProvider aiProvider = aiServiceFactory.getProvider();
            String systemPrompt = "You are AstraMind, a code quality expert. Analyze methods for complexity, design, and suggest improvements.";
            String answer = aiProvider.generateResponse(systemPrompt, "Analyze this method:\n" + methodDetails);

            Map<String, Object> response = new HashMap<>();
            response.put("answer", answer);
            response.put("methodDetails", methodDetails);
            response.put("success", true);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("error", e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    /**
     * Get refactoring suggestions for a class
     */
    @PostMapping("/suggest-refactoring/{classId}")
    public ResponseEntity<Map<String, Object>> suggestRefactoring(@PathVariable Long classId) {
        try {
            // Get class details
            String classDetails = ragService.getClassDetails(classId);

            // Build dependency context
            Map<String, Object> depContext = ragService.buildDependencyContext(classId);

            // Generate suggestions
            AIProvider aiProvider = aiServiceFactory.getProvider();
            String systemPrompt = "You are AstraMind, a refactoring expert. Identify SOLID violations, code smells, and suggest specific improvements.";
            String answer = aiProvider.generateResponse(systemPrompt, "Analyze for refactoring:\n" + classDetails);

            Map<String, Object> response = new HashMap<>();
            response.put("answer", answer);
            response.put("classDetails", classDetails);
            response.put("dependencies", depContext);
            response.put("success", true);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("error", e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    /**
     * Check Ollama connection status
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> checkStatus() {
        Map<String, Object> status = new HashMap<>();

        try {
            AIProvider aiProvider = aiServiceFactory.getProvider();
            boolean connected = aiProvider.testConnection();
            status.put("connected", connected);
            status.put("provider", aiProvider.getProviderName());
            status.put("model", aiProvider.getChatModel());
            status.put("message", connected
                    ? aiProvider.getProviderName() + " is running and ready"
                    : aiProvider.getProviderName() + " is not responding. Please check configuration.");
            status.put("success", true);

            return ResponseEntity.ok(status);
        } catch (Exception e) {
            status.put("connected", false);
            status.put("error", e.getMessage());
            status.put("success", false);
            return ResponseEntity.status(500).body(status);
        }
    }

    /**
     * Get quick action suggestions
     */
    @GetMapping("/quick-actions/{codebaseId}")
    public ResponseEntity<Map<String, Object>> getQuickActions(@PathVariable Long codebaseId) {
        Map<String, Object> response = new HashMap<>();

        response.put("actions", new String[] {
                "Explain the authentication flow",
                "What are the main components?",
                "Show me the database schema",
                "Identify potential security issues",
                "Suggest performance improvements",
                "Explain the dependency structure",
                "What design patterns are used?",
                "Are there any code smells?"
        });
        response.put("success", true);

        return ResponseEntity.ok(response);
    }
}
