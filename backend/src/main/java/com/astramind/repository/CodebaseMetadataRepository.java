package com.astramind.repository;

import com.astramind.model.CodebaseMetadata;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CodebaseMetadataRepository extends MongoRepository<CodebaseMetadata, String> {
    List<CodebaseMetadata> findByUserId(String userId);

    List<CodebaseMetadata> findByUserIdOrderByUploadedAtDesc(String userId);
}
