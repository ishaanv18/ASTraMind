package com.astramind.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.Indexed;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Document(collection = "code_metrics")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CodeMetrics {

    @Id
    private String id;

    @Indexed
    private String codebaseId;

    // Complexity Metrics
    private Double averageCyclomaticComplexity;

    private Integer maxCyclomaticComplexity;

    private Integer totalMethods;

    // Size Metrics
    private Double averageMethodLength;

    private Integer maxMethodLength;

    private Integer totalLinesOfCode;

    // Coupling Metrics
    private Double averageClassCoupling;

    private Integer maxClassCoupling;

    private Integer totalClasses;

    // Quality Score (0-100)
    private Double qualityScore;

    private LocalDateTime calculatedAt;

    public CodeMetrics(String codebaseId) {
        this.codebaseId = codebaseId;
        this.calculatedAt = LocalDateTime.now();
    }
}
