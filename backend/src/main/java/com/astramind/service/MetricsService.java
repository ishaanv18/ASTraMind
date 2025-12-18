package com.astramind.service;

import com.astramind.model.*;
import com.astramind.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class MetricsService {

    @Autowired
    private CodeMetricsRepository metricsRepository;

    @Autowired
    private CodebaseMetadataRepository codebaseRepository;

    @Autowired
    private CodeClassRepository classRepository;

    @Autowired
    private CodeMethodRepository methodRepository;

    @Autowired
    private CodeRelationshipRepository relationshipRepository;

    @Transactional
    public Map<String, Object> calculateCodebaseMetrics(Long codebaseId) {
        CodebaseMetadata codebase = codebaseRepository.findById(codebaseId)
                .orElseThrow(() -> new RuntimeException("Codebase not found"));

        List<CodeClass> classes = classRepository.findByFile_Codebase_Id(codebaseId);
        List<CodeMethod> methods = methodRepository.findByCodeClass_File_Codebase_Id(codebaseId);

        if (classes.isEmpty() || methods.isEmpty()) {
            throw new RuntimeException("No parsed code found. Please parse the codebase first.");
        }

        // Calculate metrics
        CodeMetrics metrics = new CodeMetrics();
        metrics.setCodebase(codebase);
        metrics.setCalculatedAt(LocalDateTime.now());

        // Complexity metrics
        Map<String, Object> complexityMetrics = calculateComplexityMetrics(methods);
        metrics.setAverageCyclomaticComplexity((Double) complexityMetrics.get("average"));
        metrics.setMaxCyclomaticComplexity((Integer) complexityMetrics.get("max"));
        metrics.setTotalMethods(methods.size());

        // Size metrics
        Map<String, Object> sizeMetrics = calculateSizeMetrics(methods);
        metrics.setAverageMethodLength((Double) sizeMetrics.get("average"));
        metrics.setMaxMethodLength((Integer) sizeMetrics.get("max"));
        metrics.setTotalLinesOfCode((Integer) sizeMetrics.get("total"));

        // Coupling metrics
        Map<String, Object> couplingMetrics = calculateCouplingMetrics(classes, codebaseId);
        metrics.setAverageClassCoupling((Double) couplingMetrics.get("average"));
        metrics.setMaxClassCoupling((Integer) couplingMetrics.get("max"));
        metrics.setTotalClasses(classes.size());

        // Calculate quality score
        double qualityScore = calculateQualityScore(
                metrics.getAverageCyclomaticComplexity(),
                metrics.getAverageMethodLength(),
                metrics.getAverageClassCoupling());
        metrics.setQualityScore(qualityScore);

        // Save metrics
        CodeMetrics savedMetrics = metricsRepository.save(metrics);

        // Return comprehensive response
        Map<String, Object> response = new HashMap<>();
        response.put("metrics", savedMetrics);
        response.put("complexityDistribution", complexityMetrics.get("distribution"));
        response.put("sizeDistribution", sizeMetrics.get("distribution"));
        response.put("couplingDistribution", couplingMetrics.get("distribution"));

        return response;
    }

    private Map<String, Object> calculateComplexityMetrics(List<CodeMethod> methods) {
        Map<String, Object> result = new HashMap<>();

        // Calculate complexity for each method
        List<Integer> complexities = methods.stream()
                .map(this::calculateCyclomaticComplexity)
                .collect(Collectors.toList());

        // Average and max
        double average = complexities.stream().mapToInt(Integer::intValue).average().orElse(0.0);
        int max = complexities.stream().mapToInt(Integer::intValue).max().orElse(0);

        // Distribution
        Map<String, Long> distribution = new LinkedHashMap<>();
        distribution.put("1-5", complexities.stream().filter(c -> c >= 1 && c <= 5).count());
        distribution.put("6-10", complexities.stream().filter(c -> c >= 6 && c <= 10).count());
        distribution.put("11-15", complexities.stream().filter(c -> c >= 11 && c <= 15).count());
        distribution.put("16-20", complexities.stream().filter(c -> c >= 16 && c <= 20).count());
        distribution.put("20+", complexities.stream().filter(c -> c > 20).count());

        result.put("average", average);
        result.put("max", max);
        result.put("distribution", distribution);

        return result;
    }

    private int calculateCyclomaticComplexity(CodeMethod method) {
        // Base complexity - since we don't have method body stored,
        // we'll use a simple heuristic based on method name and parameters
        int complexity = 1;

        // Simple heuristic: assume complexity based on parameter count
        if (method.getParameters() != null && !method.getParameters().isEmpty()) {
            // Count commas in parameters to estimate parameter count
            long paramCount = method.getParameters().chars().filter(ch -> ch == ',').count() + 1;
            complexity += (int) (paramCount / 2); // Add some complexity for parameters
        }

        return complexity;
    }

    private Map<String, Object> calculateSizeMetrics(List<CodeMethod> methods) {
        Map<String, Object> result = new HashMap<>();

        // Calculate lines for each method
        List<Integer> sizes = methods.stream()
                .map(this::calculateMethodSize)
                .collect(Collectors.toList());

        // Average and max
        double average = sizes.stream().mapToInt(Integer::intValue).average().orElse(0.0);
        int max = sizes.stream().mapToInt(Integer::intValue).max().orElse(0);
        int total = sizes.stream().mapToInt(Integer::intValue).sum();

        // Distribution
        Map<String, Long> distribution = new LinkedHashMap<>();
        distribution.put("1-20", sizes.stream().filter(s -> s >= 1 && s <= 20).count());
        distribution.put("21-50", sizes.stream().filter(s -> s >= 21 && s <= 50).count());
        distribution.put("51-100", sizes.stream().filter(s -> s >= 51 && s <= 100).count());
        distribution.put("100+", sizes.stream().filter(s -> s > 100).count());

        result.put("average", average);
        result.put("max", max);
        result.put("total", total);
        result.put("distribution", distribution);

        return result;
    }

    private int calculateMethodSize(CodeMethod method) {
        if (method.getEndLine() != null && method.getStartLine() != null) {
            return method.getEndLine() - method.getStartLine() + 1;
        }
        return 0;
    }

    private Map<String, Object> calculateCouplingMetrics(List<CodeClass> classes, Long codebaseId) {
        Map<String, Object> result = new HashMap<>();

        // Calculate coupling for each class
        List<Integer> couplings = classes.stream()
                .map(clazz -> calculateClassCoupling(clazz, codebaseId))
                .collect(Collectors.toList());

        // Average and max
        double average = couplings.stream().mapToInt(Integer::intValue).average().orElse(0.0);
        int max = couplings.stream().mapToInt(Integer::intValue).max().orElse(0);

        // Distribution
        Map<String, Long> distribution = new LinkedHashMap<>();
        distribution.put("0-5", couplings.stream().filter(c -> c >= 0 && c <= 5).count());
        distribution.put("6-10", couplings.stream().filter(c -> c >= 6 && c <= 10).count());
        distribution.put("11-20", couplings.stream().filter(c -> c >= 11 && c <= 20).count());
        distribution.put("20+", couplings.stream().filter(c -> c > 20).count());

        result.put("average", average);
        result.put("max", max);
        result.put("distribution", distribution);

        return result;
    }

    private int calculateClassCoupling(CodeClass clazz, Long codebaseId) {
        // Count unique dependencies (imports + extends + implements)
        List<CodeRelationship> relationships = relationshipRepository.findBySourceClass_Id(clazz.getId());

        Set<Long> uniqueDependencies = relationships.stream()
                .map(CodeRelationship::getTargetClassId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        return uniqueDependencies.size();
    }

    private double calculateQualityScore(Double avgComplexity, Double avgMethodLength, Double avgCoupling) {
        // Normalize scores (0-100)
        double complexityScore = Math.max(0, 100 - (avgComplexity / 10.0 * 100));
        double sizeScore = Math.max(0, 100 - (avgMethodLength / 50.0 * 100));
        double couplingScore = Math.max(0, 100 - (avgCoupling / 20.0 * 100));

        // Weighted average
        double qualityScore = (complexityScore * 0.4) + (sizeScore * 0.3) + (couplingScore * 0.3);

        return Math.min(100, Math.max(0, qualityScore));
    }

    public Map<String, Object> getCodebaseMetrics(Long codebaseId) {
        Optional<CodeMetrics> metricsOpt = metricsRepository.findByCodebaseId(codebaseId);

        if (metricsOpt.isPresent()) {
            return convertMetricsToMap(metricsOpt.get());
        } else {
            // Calculate if not exists
            return calculateCodebaseMetrics(codebaseId);
        }
    }

    private Map<String, Object> convertMetricsToMap(CodeMetrics metrics) {
        Map<String, Object> result = new HashMap<>();
        result.put("qualityScore", metrics.getQualityScore());
        result.put("averageComplexity", metrics.getAverageCyclomaticComplexity());
        result.put("maxComplexity", metrics.getMaxCyclomaticComplexity());
        result.put("totalMethods", metrics.getTotalMethods());
        result.put("averageMethodLength", metrics.getAverageMethodLength());
        result.put("maxMethodLength", metrics.getMaxMethodLength());
        result.put("totalLinesOfCode", metrics.getTotalLinesOfCode());
        result.put("averageCoupling", metrics.getAverageClassCoupling());
        result.put("maxCoupling", metrics.getMaxClassCoupling());
        result.put("totalClasses", metrics.getTotalClasses());
        result.put("calculatedAt", metrics.getCalculatedAt());
        return result;
    }

    public List<Map<String, Object>> getTopComplexMethods(Long codebaseId, int limit) {
        List<CodeMethod> methods = methodRepository.findByCodeClass_File_Codebase_Id(codebaseId);

        return methods.stream()
                .map(method -> {
                    Map<String, Object> methodData = new HashMap<>();
                    methodData.put("name", method.getName());
                    methodData.put("className", method.getCodeClass().getName());
                    methodData.put("complexity", calculateCyclomaticComplexity(method));
                    methodData.put("size", calculateMethodSize(method));
                    methodData.put("fileId", method.getCodeClass().getFile().getId());
                    methodData.put("startLine", method.getStartLine());
                    return methodData;
                })
                .sorted((a, b) -> Integer.compare((Integer) b.get("complexity"), (Integer) a.get("complexity")))
                .limit(limit)
                .collect(Collectors.toList());
    }

    public List<Map<String, Object>> getTopCoupledClasses(Long codebaseId, int limit) {
        List<CodeClass> classes = classRepository.findByFile_Codebase_Id(codebaseId);

        return classes.stream()
                .map(clazz -> {
                    Map<String, Object> classData = new HashMap<>();
                    classData.put("name", clazz.getName());
                    classData.put("coupling", calculateClassCoupling(clazz, codebaseId));
                    classData.put("methodCount", clazz.getMethods().size());
                    classData.put("fileId", clazz.getFile().getId());
                    classData.put("startLine", clazz.getStartLine());
                    return classData;
                })
                .sorted((a, b) -> Integer.compare((Integer) b.get("coupling"), (Integer) a.get("coupling")))
                .limit(limit)
                .collect(Collectors.toList());
    }
}
