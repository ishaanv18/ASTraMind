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

}
