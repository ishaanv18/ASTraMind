package com.astramind.dto;

import com.astramind.model.CodeClass;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SearchResult {

    private Long id;
    private String elementName;
    private String elementType; // CLASS or METHOD
    private String textContent;
    private String fileName;
    private String filePath;
    private Integer startLine;
    private Integer endLine;
    private Double similarityScore;

    // For context
    private String className;
    private String packageName;
}
