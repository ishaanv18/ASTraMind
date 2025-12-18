package com.astramind.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import com.fasterxml.jackson.annotation.JsonIgnore;
import java.time.LocalDateTime;

@Entity
@Table(name = "code_fields")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CodeField {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "class_id", nullable = false)
    @JsonIgnore
    private CodeClass codeClass;

    @Column(nullable = false)
    private String name;

    private String type;

    @Column(name = "is_static")
    private Boolean isStatic = false;

    @Column(name = "is_final")
    private Boolean isFinal = false;

    @Column(name = "line_number")
    private Integer lineNumber;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
