package com.astramind.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CodeMethod {

    private String name;

    private String returnType;

    private String parameters;

    private Boolean isStatic = false;

    private Boolean isPublic = true;

    private Integer startLine;

    private Integer endLine;

    private LocalDateTime createdAt;

    public void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
