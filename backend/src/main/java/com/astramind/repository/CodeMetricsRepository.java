package com.astramind.repository;

import com.astramind.model.CodeMetrics;
import com.astramind.model.CodebaseMetadata;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CodeMetricsRepository extends JpaRepository<CodeMetrics, Long> {
    Optional<CodeMetrics> findByCodebase(CodebaseMetadata codebase);

    Optional<CodeMetrics> findByCodebaseId(Long codebaseId);

    int deleteByCodebaseId(Long codebaseId);
}
