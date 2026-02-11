package com.astramind.service;

import com.astramind.service.ai.AIServiceFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class ChatService {

    @Autowired
    private AIServiceFactory aiServiceFactory;

    @Autowired
    private SemanticSearchService semanticSearchService;

    // Store conversation history (in-memory for now)
    private Map<String, List<Map<String, String>>> conversations = new HashMap<>();

    /**
     * Answer a question about the codebase using RAG
     */
    public Map<String, Object> askQuestion(String codebaseId, String question, String conversationId) {
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
                    8 // Top 8 most relevant pieces of code
            );

            // Build context from relevant code
            StringBuilder context = new StringBuilder();
            List<Map<String, Object>> sources = new ArrayList<>();

            if (relevantCode.isEmpty()) {
                System.out.println("⚠️  No relevant code found for question: " + question);
                context.append("No relevant code snippets were found in the codebase for this question.");
            } else {
                for (Map<String, Object> code : relevantCode) {
                    String type = (String) code.get("type");
                    String name = (String) code.get("elementName");

                    context.append("--- SOURCE: ").append(type).append(" ").append(name).append(" ---\n");
                    context.append(code.get("textContent")).append("\n");
                    context.append("--- END SOURCE ---\n\n");

                    Map<String, Object> source = new HashMap<>();
                    source.put("type", type);
                    source.put("name", name);
                    source.put("id", code.get("codeClassId"));
                    source.put("similarity", code.get("similarity"));
                    sources.add(source);
                }
            }

            // Build system instruction
            String systemInstruction = "You are a code analysis assistant helping developers understand their codebase. "
                    + "Your goal is to answer questions ACCURATELY based ONLY on the provided code context.\n\n"
                    + "RULES:\n"
                    + "1. Answer strictly based on the provided Context. Do NOT use outside knowledge or make assumptions.\n"
                    + "2. If the Context does not contain the answer, explicitly state: \"I cannot answer this based on the retrieved code.\"\n"
                    + "3. Cite the specific classes or methods you are referencing.\n"
                    + "4. Be concise and technical.\n"
                    + "5. If the user asks for code that isn't in the context, do not invent it.";

            // Generate response using configured AI provider
            String answer = aiServiceFactory.getProvider().generateResponse(
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
