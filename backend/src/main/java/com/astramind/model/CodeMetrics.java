package com.astramind.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "code_metrics")
public class CodeMetrics {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "codebase_id")
    private CodebaseMetadata codebase;

    // Complexity Metrics
    @Column(name = "avg_cyclomatic_complexity")
    private Double averageCyclomaticComplexity;

    @Column(name = "max_cyclomatic_complexity")
    private Integer maxCyclomaticComplexity;

    @Column(name = "total_methods")
    private Integer totalMethods;

    // Size Metrics
    @Column(name = "avg_method_length")
    private Double averageMethodLength;

    @Column(name = "max_method_length")
    private Integer maxMethodLength;

    @Column(name = "total_lines_of_code")
    private Integer totalLinesOfCode;

    // Coupling Metrics
    @Column(name = "avg_class_coupling")
    private Double averageClassCoupling;

    @Column(name = "max_class_coupling")
    private Integer maxClassCoupling;

    @Column(name = "total_classes")
    private Integer totalClasses;

    // Quality Score (0-100)
    @Column(name = "quality_score")
    private Double qualityScore;

    @Column(name = "calculated_at")
    private LocalDateTime calculatedAt;

    // Constructors
    public CodeMetrics() {
        this.calculatedAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public CodebaseMetadata getCodebase() {
        return codebase;
    }

    public void setCodebase(CodebaseMetadata codebase) {
        this.codebase = codebase;
    }

    public Double getAverageCyclomaticComplexity() {
        return averageCyclomaticComplexity;
    }

    public void setAverageCyclomaticComplexity(Double averageCyclomaticComplexity) {
        this.averageCyclomaticComplexity = averageCyclomaticComplexity;
    }

    public Integer getMaxCyclomaticComplexity() {
        return maxCyclomaticComplexity;
    }

    public void setMaxCyclomaticComplexity(Integer maxCyclomaticComplexity) {
        this.maxCyclomaticComplexity = maxCyclomaticComplexity;
    }

    public Integer getTotalMethods() {
        return totalMethods;
    }

    public void setTotalMethods(Integer totalMethods) {
        this.totalMethods = totalMethods;
    }

    public Double getAverageMethodLength() {
        return averageMethodLength;
    }

    public void setAverageMethodLength(Double averageMethodLength) {
        this.averageMethodLength = averageMethodLength;
    }

    public Integer getMaxMethodLength() {
        return maxMethodLength;
    }

    public void setMaxMethodLength(Integer maxMethodLength) {
        this.maxMethodLength = maxMethodLength;
    }

    public Integer getTotalLinesOfCode() {
        return totalLinesOfCode;
    }

    public void setTotalLinesOfCode(Integer totalLinesOfCode) {
        this.totalLinesOfCode = totalLinesOfCode;
    }

    public Double getAverageClassCoupling() {
        return averageClassCoupling;
    }

    public void setAverageClassCoupling(Double averageClassCoupling) {
        this.averageClassCoupling = averageClassCoupling;
    }

    public Integer getMaxClassCoupling() {
        return maxClassCoupling;
    }

    public void setMaxClassCoupling(Integer maxClassCoupling) {
        this.maxClassCoupling = maxClassCoupling;
    }

    public Integer getTotalClasses() {
        return totalClasses;
    }

    public void setTotalClasses(Integer totalClasses) {
        this.totalClasses = totalClasses;
    }

    public Double getQualityScore() {
        return qualityScore;
    }

    public void setQualityScore(Double qualityScore) {
        this.qualityScore = qualityScore;
    }

    public LocalDateTime getCalculatedAt() {
        return calculatedAt;
    }

    public void setCalculatedAt(LocalDateTime calculatedAt) {
        this.calculatedAt = calculatedAt;
    }
}
