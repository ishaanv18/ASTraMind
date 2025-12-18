package com.astramind.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class ChatService {

    @Autowired
    private GeminiService geminiService;

    @Autowired
    private SemanticSearchService semanticSearchService;

    // Store conversation history (in-memory for now)
    private Map<String, List<Map<String, String>>> conversations = new HashMap<>();

    /**
     * Answer a question about the codebase using RAG
     */
    public Map<String, Object> askQuestion(Long codebaseId, String question, String conversationId) {
        try {
            // Generate or retrieve conversation ID
            if (conversationId == null || conversationId.isEmpty()) {
                conversationId = UUID.randomUUID().toString();
            }

            // Retrieve relevant code context using semantic search
            List<Map<String, Object>> relevantCode = semanticSearchService.searchByQuery(
                    codebaseId,
                    question,
                    "ALL",
                    5 // Top 5 most relevant pieces of code
            );

            // Build context from relevant code
            StringBuilder context = new StringBuilder();
            List<Map<String, Object>> sources = new ArrayList<>();

            for (Map<String, Object> code : relevantCode) {
                context.append(code.get("textContent")).append("\n\n");

                Map<String, Object> source = new HashMap<>();
                source.put("type", code.get("type"));
                source.put("name", code.get("name"));
                source.put("id", code.get("id"));
                source.put("similarity", code.get("similarity"));
                sources.add(source);
            }

            // Build system instruction
            String systemInstruction = "You are a code analysis assistant helping developers understand their codebase. "
                    +
                    "Answer questions based on the provided code context. " +
                    "Be concise, accurate, and cite specific classes or methods when relevant. " +
                    "If the context doesn't contain enough information, say so honestly.";

            // Generate response using Gemini
            String answer = geminiService.generateResponseWithInstructions(
                    systemInstruction,
                    "Context:\n" + context.toString() + "\n\nQuestion: " + question);

            // Store conversation history
            List<Map<String, String>> history = conversations.getOrDefault(conversationId, new ArrayList<>());
            Map<String, String> exchange = new HashMap<>();
            exchange.put("question", question);
            exchange.put("answer", answer);
            history.add(exchange);
            conversations.put(conversationId, history);

            // Build response
            Map<String, Object> response = new HashMap<>();
            response.put("answer", answer);
            response.put("sources", sources);
            response.put("conversationId", conversationId);

            return response;

        } catch (Exception e) {
            throw new RuntimeException("Failed to answer question: " + e.getMessage(), e);
        }
    }

    /**
     * Get conversation history
     */
    public List<Map<String, String>> getConversationHistory(String conversationId) {
        return conversations.getOrDefault(conversationId, new ArrayList<>());
    }

    /**
     * Clear conversation history
     */
    public void clearConversation(String conversationId) {
        conversations.remove(conversationId);
    }
}
