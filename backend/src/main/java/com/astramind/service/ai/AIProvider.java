package com.astramind.service.ai;

/**
 * Provider-agnostic interface for AI services
 * Supports multiple AI providers (Ollama, Groq, Gemini, etc.)
 */
public interface AIProvider {

    /**
     * Generate a response from the AI model
     * 
     * @param systemPrompt System instructions for the AI
     * @param userPrompt   User's question or request
     * @return AI-generated response
     */
    String generateResponse(String systemPrompt, String userPrompt);

    /**
     * Generate embedding vector for text
     * 
     * @param text Text to embed
     * @return Embedding vector as float array
     */
    float[] generateEmbedding(String text);

    /**
     * Test connection to the AI provider
     * 
     * @return true if connection is successful
     */
    boolean testConnection();

    /**
     * Get the name of the AI provider
     * 
     * @return Provider name (e.g., "Ollama", "Groq", "Gemini")
     */
    String getProviderName();

    /**
     * Get the model being used for chat
     * 
     * @return Model name
     */
    String getChatModel();

    /**
     * Get the model being used for embeddings
     * 
     * @return Embedding model name
     */
    String getEmbeddingModel();
}
