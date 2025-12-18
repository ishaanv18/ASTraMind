package com.astramind.controller;

import com.astramind.repository.CodeEmbeddingRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/debug")
public class DebugController {

    @Autowired
    private CodeEmbeddingRepository codeEmbeddingRepository;

    /**
     * Check what embedding types exist in the database
     */
    @GetMapping("/embedding-types/{codebaseId}")
    public Map<String, Object> getEmbeddingTypes(@PathVariable Long codebaseId) {
        Map<String, Object> result = new HashMap<>();

        try {
            // Get all embeddings for this codebase
            var embeddings = codeEmbeddingRepository.findByCodeFile_Codebase_Id(codebaseId);

            // Count by type
            Map<String, Long> typeCounts = embeddings.stream()
                    .collect(Collectors.groupingBy(
                            e -> e.getCodeElementType() != null ? e.getCodeElementType() : "NULL",
                            Collectors.counting()));

            result.put("totalEmbeddings", embeddings.size());
            result.put("typeCounts", typeCounts);
            result.put("types", new ArrayList<>(typeCounts.keySet()));
            result.put("success", true);

        } catch (Exception e) {
            result.put("success", false);
            result.put("error", e.getMessage());
        }

        return result;
    }
}
