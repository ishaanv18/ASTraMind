package com.astramind.repository;

import com.astramind.model.CodeEmbedding;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CodeEmbeddingRepository extends MongoRepository<CodeEmbedding, String> {

        List<CodeEmbedding> findByCodeClassId(String classId);

        List<CodeEmbedding> findByCodeMethodId(String methodId);

        List<CodeEmbedding> findByEmbeddingType(String embeddingType);

        List<CodeEmbedding> findByCodeFileId(String codeFileId);

        long countByCodeFileId(String codeFileId);

        void deleteByCodeClassId(String classId);

        void deleteByCodeMethodId(String methodId);

        int deleteByCodeFileId(String codeFileId);
}
