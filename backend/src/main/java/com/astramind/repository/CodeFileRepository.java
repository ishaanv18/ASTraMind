package com.astramind.repository;

import com.astramind.model.CodeFile;
import com.astramind.model.CodebaseMetadata;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CodeFileRepository extends JpaRepository<CodeFile, Long> {
    List<CodeFile> findByCodebase(CodebaseMetadata codebase);

    List<CodeFile> findByCodebaseAndLanguage(CodebaseMetadata codebase, String language);

    List<CodeFile> findByCodebaseId(Long codebaseId);

    int deleteByCodebaseId(Long codebaseId);
}
