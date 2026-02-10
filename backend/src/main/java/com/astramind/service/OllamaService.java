package com.astramind.service;

import com.astramind.service.ai.AIProvider;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class OllamaService implements AIProvider {

    private final WebClient webClient;
    private static final String OLLAMA_BASE_URL = "http://localhost:11434";
    private static final String DEFAULT_MODEL = "deepseek-coder:6.7b";

    public OllamaService() {
        this.webClient = WebClient.builder()
                .baseUrl(OLLAMA_BASE_URL)
                .build();
    }

    /**
     * Generate a response from Ollama
     */
    public String generateResponse(String prompt) {
        return generateResponseWithModel(prompt, DEFAULT_MODEL);
    }

    /**
     * Generate a response with specific model
     */
    public String generateResponseWithModel(String prompt, String model) {
        try {
            Map<String, Object> request = new HashMap<>();
            request.put("model", model);
            request.put("prompt", prompt);
            request.put("stream", false);

            String response = webClient.post()
                    .uri("/api/generate")
                    .header("Content-Type", "application/json")
                    .bodyValue(request)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            return extractResponseText(response);
        } catch (Exception e) {
            System.err.println("Ollama API error: " + e.getMessage());
            e.printStackTrace();
            return "Error: Unable to connect to Ollama. Please ensure Ollama is running with DeepSeek-Coder model.";
        }
    }

    /**
     * Generate code analysis with structured prompt
     */
    public String generateCodeAnalysis(String code, String question, String context) {
        String prompt = buildAnalysisPrompt(code, question, context);
        return generateResponse(prompt);
    }

    /**
     * Test connection to Ollama
     */
    public boolean testConnection() {
        try {
            Map<String, Object> request = new HashMap<>();
            request.put("model", DEFAULT_MODEL);
            request.put("prompt", "Hello");
            request.put("stream", false);

            String response = webClient.post()
                    .uri("/api/generate")
                    .header("Content-Type", "application/json")
                    .bodyValue(request)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            return response != null && !response.isEmpty();
        } catch (Exception e) {
            System.err.println("Ollama connection test failed: " + e.getMessage());
            e.printStackTrace();
            return false;
        }
    }

    /**
     * List available models
     */
    public List<String> listAvailableModels() {
        try {
            String response = webClient.get()
                    .uri("/api/tags")
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            // Parse and return model names
            return List.of(DEFAULT_MODEL); // Simplified for now
        } catch (Exception e) {
            return List.of();
        }
    }

    /**
     * Extract response text from Ollama JSON response
     */
    private String extractResponseText(String jsonResponse) {
        try {
            // Parse JSON and extract "response" field
            int responseStart = jsonResponse.indexOf("\"response\":\"") + 12;
            int responseEnd = jsonResponse.indexOf("\",\"", responseStart);

            if (responseStart > 11 && responseEnd > responseStart) {
                String response = jsonResponse.substring(responseStart, responseEnd);
                // Unescape JSON string
                return response.replace("\\n", "\n")
                        .replace("\\\"", "\"")
                        .replace("\\\\", "\\");
            }

            return jsonResponse;
        } catch (Exception e) {
            return jsonResponse;
        }
    }

    /**
     * Build structured prompt for code analysis
     */
    private String buildAnalysisPrompt(String code, String question, String context) {
        StringBuilder prompt = new StringBuilder();

        prompt.append("You are AstraMind, a senior software engineer AI assistant.\n");
        prompt.append("You analyze Java codebases and provide expert insights.\n\n");

        prompt.append("Guidelines:\n");
        prompt.append("- Be concise but thorough\n");
        prompt.append("- Reference specific code when explaining\n");
        prompt.append("- Suggest practical improvements\n");
        prompt.append("- Identify risks and trade-offs\n");
        prompt.append("- Follow SOLID principles\n\n");

        if (context != null && !context.isEmpty()) {
            prompt.append("Context:\n");
            prompt.append(context);
            prompt.append("\n\n");
        }

        if (code != null && !code.isEmpty()) {
            prompt.append("Code:\n");
            prompt.append(code);
            prompt.append("\n\n");
        }

        prompt.append("Question: ");
        prompt.append(question);
        prompt.append("\n\n");

        prompt.append("Provide a detailed analysis with:\n");
        prompt.append("1. Direct answer\n");
        prompt.append("2. Code explanation (if applicable)\n");
        prompt.append("3. Potential issues\n");
        prompt.append("4. Suggestions for improvement\n");

        return prompt.toString();
    }

    // AIProvider interface methods

    @Override
    public String generateResponse(String systemPrompt, String userPrompt) {
        // Combine system and user prompts for Ollama
        String combinedPrompt = systemPrompt != null && !systemPrompt.isEmpty()
                ? systemPrompt + "\n\n" + userPrompt
                : userPrompt;
        return generateResponse(combinedPrompt);
    }

    @Override
    public float[] generateEmbedding(String text) {
        // Ollama doesn't provide embeddings in production
        // This would need to be implemented with a separate embedding model
        throw new UnsupportedOperationException(
                "Ollama embeddings not implemented. Use Groq or Gemini for embeddings.");
    }

    @Override
    public String getProviderName() {
        return "Ollama";
    }

    @Override
    public String getChatModel() {
        return DEFAULT_MODEL;
    }

    @Override
    public String getEmbeddingModel() {
        return "Not supported";
    }
}
