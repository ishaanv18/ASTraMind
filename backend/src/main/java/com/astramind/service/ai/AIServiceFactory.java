package com.astramind.service.ai;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Factory for selecting AI provider based on environment configuration
 * Supports: Ollama (local), Groq (production), Gemini (alternative)
 */
@Service
public class AIServiceFactory {

    @Value("${ai.provider:ollama}")
    private String provider;

    @Autowired(required = false)
    private com.astramind.service.OllamaService ollamaService;

    @Autowired(required = false)
    private GroqService groqService;

    @Autowired(required = false)
    private com.astramind.service.GeminiService geminiService;

    /**
     * Get the configured AI provider
     * 
     * @return AIProvider instance based on configuration
     */
    public AIProvider getProvider() {
        System.out.println("DEBUG: Using AI provider: " + provider);

        switch (provider.toLowerCase()) {
            case "groq":
                if (groqService == null) {
                    throw new RuntimeException("Groq service not configured. Check application.properties");
                }
                return groqService;

            case "gemini":
                if (geminiService == null) {
                    throw new RuntimeException("Gemini service not configured. Check application.properties");
                }
                return new GeminiAIProviderAdapter(geminiService);

            case "ollama":
            default:
                if (ollamaService == null) {
                    throw new RuntimeException("Ollama service not configured. Ensure Ollama is running.");
                }
                return ollamaService;
        }
    }

    /**
     * Get the current provider name
     */
    public String getCurrentProvider() {
        return provider;
    }

    /**
     * Adapter to make GeminiService compatible with AIProvider interface
     */
    private static class GeminiAIProviderAdapter implements AIProvider {
        private final com.astramind.service.GeminiService geminiService;

        public GeminiAIProviderAdapter(com.astramind.service.GeminiService geminiService) {
            this.geminiService = geminiService;
        }

        @Override
        public String generateResponse(String systemPrompt, String userPrompt) {
            return geminiService.generateResponseWithInstructions(systemPrompt, userPrompt);
        }

        @Override
        public float[] generateEmbedding(String text) {
            return geminiService.generateEmbedding(text);
        }

        @Override
        public boolean testConnection() {
            return geminiService.testConnection();
        }

        @Override
        public String getProviderName() {
            return "Gemini";
        }

        @Override
        public String getChatModel() {
            return "gemini-2.5-flash";
        }

        @Override
        public String getEmbeddingModel() {
            return "text-embedding-004";
        }
    }
}
