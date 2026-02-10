package com.astramind.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.Indexed;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Document(collection = "code_relationships")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CodeRelationship {

    @Id
    private String id;

    @Indexed
    private String sourceClassId;

    private String targetClassId;

    private String relationshipType; // IMPORTS, EXTENDS, IMPLEMENTS, USES

    private String sourceMethodId;

    private String targetMethodId;

    private String targetClassName;

    private Integer lineNumber;

    private LocalDateTime createdAt;

    public void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
