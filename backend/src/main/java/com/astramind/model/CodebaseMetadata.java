package com.astramind.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import com.fasterxml.jackson.annotation.JsonIgnore;
import java.time.LocalDateTime;

@Entity
@Table(name = "codebase_metadata")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CodebaseMetadata {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @JsonIgnore
    private User user;

    @Column(nullable = false)
    private String name;

    @Column(length = 1000)
    private String description;

    @Column(length = 255) // Assuming a reasonable length for primary language
    private String primaryLanguage;

    @Column(length = 500) // Longer length for URL
    private String githubUrl;

    @Column(length = 1000)
    private String localPath;

    private Integer fileCount = 0;

    private Integer classCount;

    private Integer functionCount;

    @Column(name = "uploaded_at")
    private LocalDateTime uploadedAt;

    @Column(name = "status")
    private String status = "PENDING"; // PENDING, CLONING, PROCESSING, COMPLETED, FAILED

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "is_parsed")
    private Boolean isParsed = false;

    @PrePersist
    protected void onCreate() {
        uploadedAt = LocalDateTime.now();
    }
}
