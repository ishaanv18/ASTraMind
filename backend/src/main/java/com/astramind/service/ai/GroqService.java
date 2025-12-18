package com.astramind.service.ai;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;

/**
 * Groq API implementation for production deployment
 * Uses OpenAI-compatible API format
 * Models: deepseek-r1-distill-llama-70b (chat), nomic-embed-text (embeddings)
 */
@Service
public class GroqService implements AIProvider {

    @Value("${groq.api.key}")
    private String apiKey;

    @Value("${groq.api.url}")
    private String apiUrl;

    @Value("${groq.chat.model}")
    private String chatModel;

    @Value("${groq.embedding.model}")
    private String embeddingModel;

    private final RestTemplate restTemplate = new RestTemplate();

    @Override
    public String generateResponse(String systemPrompt, String userPrompt) {
        try {
            String url = apiUrl + "/chat/completions";

            // Build request body in OpenAI format
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", chatModel);

            // Add messages
            List<Map<String, String>> messages = new ArrayList<>();

            // System message
            if (systemPrompt != null && !systemPrompt.isEmpty()) {
                Map<String, String> systemMessage = new HashMap<>();
                systemMessage.put("role", "system");
                systemMessage.put("content", systemPrompt);
                messages.add(systemMessage);
            }

            // User message
            Map<String, String> userMessage = new HashMap<>();
            userMessage.put("role", "user");
            userMessage.put("content", userPrompt);
            messages.add(userMessage);

            requestBody.put("messages", messages);
            requestBody.put("temperature", 0.7);
            requestBody.put("max_tokens", 2048);

            // Set headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(apiKey);

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);

            System.out.println("DEBUG: Calling Groq API with model: " + chatModel);

            // Make API call
            ResponseEntity<Map> response = restTemplate.postForEntity(url, request, Map.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Map<String, Object> body = response.getBody();
                List<Map<String, Object>> choices = (List<Map<String, Object>>) body.get("choices");

                if (choices != null && !choices.isEmpty()) {
                    Map<String, Object> choice = choices.get(0);
                    Map<String, Object> message = (Map<String, Object>) choice.get("message");
                    String content = (String) message.get("content");

                    System.out.println("DEBUG: Groq response received successfully");
                    return content;
                }
            }

            throw new RuntimeException("Failed to extract response from Groq API");

        } catch (Exception e) {
            System.err.println("ERROR: Groq API call failed: " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException("Failed to generate response from Groq: " + e.getMessage(), e);
        }
    }

    @Override
    public float[] generateEmbedding(String text) {
        try {
            // Groq uses OpenAI-compatible embedding endpoint
            String url = apiUrl + "/embeddings";

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", embeddingModel);
            requestBody.put("input", text);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(apiKey);

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);

            System.out.println("DEBUG: Calling Groq embedding API with model: " + embeddingModel);

            ResponseEntity<Map> response = restTemplate.postForEntity(url, request, Map.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Map<String, Object> body = response.getBody();
                List<Map<String, Object>> data = (List<Map<String, Object>>) body.get("data");

                if (data != null && !data.isEmpty()) {
                    Map<String, Object> embeddingData = data.get(0);
                    List<Double> embedding = (List<Double>) embeddingData.get("embedding");

                    float[] result = new float[embedding.size()];
                    for (int i = 0; i < embedding.size(); i++) {
                        result[i] = embedding.get(i).floatValue();
                    }

                    System.out.println("DEBUG: Generated embedding with " + result.length + " dimensions");
                    return result;
                }
            }

            throw new RuntimeException("Failed to extract embedding from Groq API");

        } catch (Exception e) {
            System.err.println("ERROR: Groq embedding generation failed: " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException("Failed to generate embedding from Groq: " + e.getMessage(), e);
        }
    }

    @Override
    public boolean testConnection() {
        try {
            String response = generateResponse(null, "Hello, respond with 'OK' if you can read this.");
            return response != null && !response.isEmpty();
        } catch (Exception e) {
            System.err.println("Groq API connection test failed: " + e.getMessage());
            return false;
        }
    }

    @Override
    public String getProviderName() {
        return "Groq";
    }

    @Override
    public String getChatModel() {
        return chatModel;
    }

    @Override
    public String getEmbeddingModel() {
        return embeddingModel;
    }
}
