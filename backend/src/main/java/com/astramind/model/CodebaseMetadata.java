package com.astramind.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.Indexed;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Document(collection = "codebase_metadata")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CodebaseMetadata {

    @Id
    private String id;

    @Indexed
    private String userId;

    private String name;

    private String description;

    private String primaryLanguage;

    private String githubUrl;

    private String localPath;

    private Integer fileCount = 0;

    private Integer classCount;

    private Integer functionCount;

    private LocalDateTime uploadedAt;

    private String status = "PENDING"; // PENDING, CLONING, PROCESSING, COMPLETED, FAILED

    private String errorMessage;

    private Boolean isParsed = false;

    public void onCreate() {
        uploadedAt = LocalDateTime.now();
    }
}
