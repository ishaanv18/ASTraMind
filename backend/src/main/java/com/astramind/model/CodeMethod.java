package com.astramind.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import com.fasterxml.jackson.annotation.JsonIgnore;
import java.time.LocalDateTime;

@Entity
@Table(name = "code_methods")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CodeMethod {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "class_id", nullable = false)
    @JsonIgnore
    private CodeClass codeClass;

    @Column(nullable = false)
    private String name;

    @Column(name = "return_type")
    private String returnType;

    @Column(columnDefinition = "TEXT")
    private String parameters;

    @Column(name = "is_static")
    private Boolean isStatic = false;

    @Column(name = "is_public")
    private Boolean isPublic = true;

    @Column(name = "start_line")
    private Integer startLine;

    @Column(name = "end_line")
    private Integer endLine;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
