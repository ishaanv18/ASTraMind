package com.astramind.repository;

import com.astramind.model.CodeMetrics;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface CodeMetricsRepository extends MongoRepository<CodeMetrics, String> {
    Optional<CodeMetrics> findByCodebaseId(String codebaseId);

    int deleteByCodebaseId(String codebaseId);
}
