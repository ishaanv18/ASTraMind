package com.astramind.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.Indexed;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "code_classes")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CodeClass {

    @Id
    private String id;

    @Indexed
    private String fileId;

    private String name;

    private String packageName;

    private String fullyQualifiedName;

    private Boolean isInterface = false;

    private Boolean isAbstract = false;

    private String extendsClass;

    private Integer startLine;

    private Integer endLine;

    private LocalDateTime createdAt;

    // Embedded documents for better performance
    private List<CodeMethod> methods = new ArrayList<>();

    private List<CodeField> fields = new ArrayList<>();

    public void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
