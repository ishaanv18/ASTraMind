package com.astramind.controller;

import com.astramind.service.MetricsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/metrics")
@CrossOrigin(origins = { "http://localhost:3000", "http://localhost:5173" }, allowCredentials = "true")
public class MetricsController {

    @Autowired
    private MetricsService metricsService;

    @GetMapping("/codebases/{id}")
    public ResponseEntity<Map<String, Object>> getCodebaseMetrics(@PathVariable Long id) {
        try {
            Map<String, Object> metrics = metricsService.getCodebaseMetrics(id);
            return ResponseEntity.ok(metrics);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/codebases/{id}/calculate")
    public ResponseEntity<Map<String, Object>> calculateMetrics(@PathVariable Long id) {
        try {
            Map<String, Object> metrics = metricsService.calculateCodebaseMetrics(id);
            return ResponseEntity.ok(metrics);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/codebases/{id}/methods/top-complex")
    public ResponseEntity<List<Map<String, Object>>> getTopComplexMethods(
            @PathVariable Long id,
            @RequestParam(defaultValue = "10") int limit) {
        try {
            List<Map<String, Object>> methods = metricsService.getTopComplexMethods(id, limit);
            return ResponseEntity.ok(methods);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(List.of(Map.of("error", e.getMessage())));
        }
    }

    @GetMapping("/codebases/{id}/classes/top-coupled")
    public ResponseEntity<List<Map<String, Object>>> getTopCoupledClasses(
            @PathVariable Long id,
            @RequestParam(defaultValue = "10") int limit) {
        try {
            List<Map<String, Object>> classes = metricsService.getTopCoupledClasses(id, limit);
            return ResponseEntity.ok(classes);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(List.of(Map.of("error", e.getMessage())));
        }
    }
}
