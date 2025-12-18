package com.astramind.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@Service
public class GeminiService {

    @Value("${gemini.api.key}")
    private String apiKey;

    @Value("${gemini.api.embedding-model}")
    private String embeddingModel;

    @Value("${gemini.api.model}")
    private String chatModel;

    private final RestTemplate restTemplate = new RestTemplate();

    /**
     * Generate embedding for a single text using Gemini API
     */
    public float[] generateEmbedding(String text) {
        try {
            String url = String.format(
                    "https://generativelanguage.googleapis.com/v1beta/models/%s:embedContent?key=%s",
                    embeddingModel, apiKey);

            Map<String, Object> requestBody = new HashMap<>();
            Map<String, Object> content = new HashMap<>();
            List<Map<String, String>> parts = new ArrayList<>();
            Map<String, String> part = new HashMap<>();
            part.put("text", text);
            parts.add(part);
            content.put("parts", parts);
            requestBody.put("content", content);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);

            System.out.println("DEBUG: Calling Gemini embedding API for text length: " + text.length());
            System.out.println("DEBUG: URL: " + url.replace(apiKey, "***"));

            ResponseEntity<Map> response = restTemplate.postForEntity(url, request, Map.class);

            System.out.println("DEBUG: Response status: " + response.getStatusCode());
            System.out.println("DEBUG: Response body: " + response.getBody());

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Map<String, Object> body = response.getBody();
                Map<String, Object> embedding = (Map<String, Object>) body.get("embedding");
                if (embedding != null && embedding.containsKey("values")) {
                    List<Double> values = (List<Double>) embedding.get("values");
                    float[] result = new float[values.size()];
                    for (int i = 0; i < values.size(); i++) {
                        result[i] = values.get(i).floatValue();
                    }
                    System.out.println("DEBUG: Successfully generated embedding with " + result.length + " dimensions");
                    return result;
                }
            }

            System.err.println("ERROR: Failed to extract embedding from response: " + response.getBody());
            throw new RuntimeException("Failed to extract embedding from response");

        } catch (Exception e) {
            System.err.println("ERROR: Exception during embedding generation: " + e.getClass().getName());
            System.err.println("ERROR: Message: " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException("Failed to generate embedding: " + e.getMessage(), e);
        }
    }

    /**
     * Generate embeddings for multiple texts in batch
     */
    public List<float[]> batchGenerateEmbeddings(List<String> texts) {
        List<float[]> embeddings = new ArrayList<>();
        for (String text : texts) {
            try {
                embeddings.add(generateEmbedding(text));
                // Add small delay to avoid rate limiting
                Thread.sleep(100);
            } catch (Exception e) {
                System.err.println("Failed to generate embedding for text: " + e.getMessage());
                // Add zero vector as placeholder
                embeddings.add(new float[768]);
            }
        }
        return embeddings;
    }

    /**
     * Generate a chat response using Gemini
     */
    public String generateChatResponse(String prompt, String context) {
        try {
            String url = String.format(
                    "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s",
                    chatModel, apiKey);

            // Build the full prompt with context
            String fullPrompt = context != null && !context.isEmpty()
                    ? "Context:\n" + context + "\n\nQuestion: " + prompt
                    : prompt;

            Map<String, Object> requestBody = new HashMap<>();
            List<Map<String, Object>> contents = new ArrayList<>();
            Map<String, Object> content = new HashMap<>();
            List<Map<String, String>> parts = new ArrayList<>();
            Map<String, String> part = new HashMap<>();
            part.put("text", fullPrompt);
            parts.add(part);
            content.put("parts", parts);
            contents.add(content);
            requestBody.put("contents", contents);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);
            ResponseEntity<Map> response = restTemplate.postForEntity(url, request, Map.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Map<String, Object> body = response.getBody();
                List<Map<String, Object>> candidates = (List<Map<String, Object>>) body.get("candidates");
                if (candidates != null && !candidates.isEmpty()) {
                    Map<String, Object> candidate = candidates.get(0);
                    Map<String, Object> contentObj = (Map<String, Object>) candidate.get("content");
                    List<Map<String, Object>> partsObj = (List<Map<String, Object>>) contentObj.get("parts");
                    if (partsObj != null && !partsObj.isEmpty()) {
                        return (String) partsObj.get(0).get("text");
                    }
                }
            }

            throw new RuntimeException("Failed to extract response from Gemini");

        } catch (Exception e) {
            throw new RuntimeException("Failed to generate chat response: " + e.getMessage(), e);
        }
    }

    /**
     * Generate a response with system instructions
     */
    public String generateResponseWithInstructions(String systemInstruction, String userPrompt) {
        try {
            String url = String.format(
                    "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s",
                    chatModel, apiKey);

            Map<String, Object> requestBody = new HashMap<>();

            // Add system instruction
            requestBody.put("systemInstruction", Map.of(
                    "parts", List.of(Map.of("text", systemInstruction))));

            // Add user prompt
            List<Map<String, Object>> contents = new ArrayList<>();
            Map<String, Object> content = new HashMap<>();
            List<Map<String, String>> parts = new ArrayList<>();
            Map<String, String> part = new HashMap<>();
            part.put("text", userPrompt);
            parts.add(part);
            content.put("parts", parts);
            contents.add(content);
            requestBody.put("contents", contents);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);
            ResponseEntity<Map> response = restTemplate.postForEntity(url, request, Map.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Map<String, Object> body = response.getBody();
                List<Map<String, Object>> candidates = (List<Map<String, Object>>) body.get("candidates");
                if (candidates != null && !candidates.isEmpty()) {
                    Map<String, Object> candidate = candidates.get(0);
                    Map<String, Object> contentObj = (Map<String, Object>) candidate.get("content");
                    List<Map<String, Object>> partsObj = (List<Map<String, Object>>) contentObj.get("parts");
                    if (partsObj != null && !partsObj.isEmpty()) {
                        return (String) partsObj.get(0).get("text");
                    }
                }
            }

            throw new RuntimeException("Failed to extract response from Gemini");

        } catch (Exception e) {
            throw new RuntimeException("Failed to generate response: " + e.getMessage(), e);
        }
    }

    /**
     * Test API connectivity
     */
    public boolean testConnection() {
        try {
            String response = generateChatResponse("Hello", null);
            return response != null && !response.isEmpty();
        } catch (Exception e) {
            System.err.println("Gemini API connection test failed: " + e.getMessage());
            return false;
        }
    }
}
