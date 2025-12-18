package com.astramind.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;

/**
 * Service for generating code embeddings using a local model.
 * Currently uses a hash-based approach for immediate functionality.
 * Can be upgraded to ONNX model when model files are available.
 */
@Service
public class LocalEmbeddingService {

    @Value("${embedding.dimension:384}")
    private int embeddingDimension;

    @PostConstruct
    public void initialize() {
        System.out.println("===========================================");
        System.out.println("Local Embedding Service Initialized");
        System.out.println("Using hash-based embeddings (dimension: " + embeddingDimension + ")");
        System.out.println("No API quota limits - unlimited embeddings!");
        System.out.println("===========================================");
    }

    /**
     * Generate embedding vector for given text using hash-based approach.
     * This provides basic semantic similarity without requiring external APIs.
     */
    public float[] generateEmbedding(String text) {
        if (text == null || text.trim().isEmpty()) {
            return new float[embeddingDimension];
        }

        float[] embedding = new float[embeddingDimension];

        // Normalize text
        String normalized = text.toLowerCase().trim();

        // Use character trigrams with hashing for fine-grained features
        for (int i = 0; i < normalized.length() - 2; i++) {
            String trigram = normalized.substring(i, i + 3);
            int hash = Math.abs(trigram.hashCode());
            int index = hash % embeddingDimension;
            embedding[index] += 1.0f;
        }

        // Add word-level features (weighted higher)
        String[] words = normalized.split("\\s+");
        for (String word : words) {
            if (word.length() > 0) {
                int hash = Math.abs(word.hashCode());
                int index = hash % embeddingDimension;
                embedding[index] += 2.0f; // Words weighted higher than trigrams
            }
        }

        // Add bigram features for better context
        for (int i = 0; i < words.length - 1; i++) {
            String bigram = words[i] + " " + words[i + 1];
            int hash = Math.abs(bigram.hashCode());
            int index = hash % embeddingDimension;
            embedding[index] += 1.5f;
        }

        // Normalize the embedding vector (L2 normalization)
        float norm = 0.0f;
        for (float v : embedding) {
            norm += v * v;
        }
        norm = (float) Math.sqrt(norm);

        if (norm > 0) {
            for (int i = 0; i < embedding.length; i++) {
                embedding[i] /= norm;
            }
        }

        return embedding;
    }

    public int getEmbeddingDimension() {
        return embeddingDimension;
    }
}
