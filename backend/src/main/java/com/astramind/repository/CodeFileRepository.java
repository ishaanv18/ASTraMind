package com.astramind.repository;

import com.astramind.model.CodeFile;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CodeFileRepository extends MongoRepository<CodeFile, String> {
    List<CodeFile> findByCodebaseId(String codebaseId);

    List<CodeFile> findByCodebaseIdAndLanguage(String codebaseId, String language);

    int deleteByCodebaseId(String codebaseId);
}
