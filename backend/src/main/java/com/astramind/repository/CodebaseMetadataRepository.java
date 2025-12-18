package com.astramind.repository;

import com.astramind.model.CodebaseMetadata;
import com.astramind.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CodebaseMetadataRepository extends JpaRepository<CodebaseMetadata, Long> {
    List<CodebaseMetadata> findByUser(User user);

    List<CodebaseMetadata> findByUserOrderByUploadedAtDesc(User user);

    List<CodebaseMetadata> findByUserIdOrderByUploadedAtDesc(Long userId);
}
