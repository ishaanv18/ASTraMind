package com.astramind.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "code_relationships")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CodeRelationship {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_class_id")
    private CodeClass sourceClass;

    @Column(name = "target_class_id")
    private Long targetClassId;

    @Column(name = "relationship_type", nullable = false)
    private String relationshipType; // IMPORTS, EXTENDS, IMPLEMENTS, USES

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_method_id")
    private CodeMethod sourceMethod;

    @Column(name = "target_method_id")
    private Long targetMethodId;

    @Column(name = "target_class_name")
    private String targetClassName;

    @Column(name = "line_number")
    private Integer lineNumber;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
