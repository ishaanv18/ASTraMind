package com.astramind.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "code_files")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CodeFile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "codebase_id", nullable = false)
    private CodebaseMetadata codebase;

    @Column(nullable = false)
    private String filePath;

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(nullable = false)
    private String language;

    @Column(columnDefinition = "TEXT")
    private String astData;

    private Integer lineCount;

    private Integer classCount;

    private Integer functionCount;
}
