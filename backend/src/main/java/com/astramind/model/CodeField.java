package com.astramind.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CodeField {

    private String name;

    private String type;

    private Boolean isStatic = false;

    private Boolean isFinal = false;

    private Integer lineNumber;

    private LocalDateTime createdAt;

    public void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
