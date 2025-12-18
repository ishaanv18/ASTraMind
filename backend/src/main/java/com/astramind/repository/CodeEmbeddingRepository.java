package com.astramind.repository;

import com.astramind.model.CodeEmbedding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CodeEmbeddingRepository extends JpaRepository<CodeEmbedding, Long> {

        List<CodeEmbedding> findByCodeClassId(Long classId);

        List<CodeEmbedding> findByCodeMethodId(Long methodId);

        List<CodeEmbedding> findByEmbeddingType(String embeddingType);

        List<CodeEmbedding> findByCodeFile_Codebase_Id(Long codebaseId);

        @Query(value = "SELECT * FROM code_embeddings " +
                        "WHERE code_class_id IN " +
                        "(SELECT id FROM code_classes WHERE file_id IN " +
                        "  (SELECT id FROM code_files WHERE codebase_id = :codebaseId))", nativeQuery = true)
        List<CodeEmbedding> findByCodebaseId(@Param("codebaseId") Long codebaseId);

        @Query(value = "SELECT COUNT(*) FROM code_embeddings " +
                        "WHERE code_class_id IN " +
                        "(SELECT id FROM code_classes WHERE file_id IN " +
                        "  (SELECT id FROM code_files WHERE codebase_id = :codebaseId))", nativeQuery = true)
        long countByCodebaseId(@Param("codebaseId") Long codebaseId);

        @Query(value = "SELECT COUNT(*) FROM code_embeddings " +
                        "WHERE code_element_type = :type AND code_class_id IN " +
                        "(SELECT id FROM code_classes WHERE file_id IN " +
                        "  (SELECT id FROM code_files WHERE codebase_id = :codebaseId))", nativeQuery = true)
        long countByCodebaseIdAndElementType(@Param("codebaseId") Long codebaseId, @Param("type") String type);

        void deleteByCodeClassId(Long classId);

        void deleteByCodeMethodId(Long methodId);

        @Modifying
        @Query(value = "DELETE FROM code_embeddings " +
                        "WHERE code_class_id IN " +
                        "(SELECT id FROM code_classes WHERE file_id IN " +
                        "  (SELECT id FROM code_files WHERE codebase_id = :codebaseId)) " +
                        "OR code_method_id IN " +
                        "(SELECT id FROM code_methods WHERE class_id IN " +
                        "  (SELECT id FROM code_classes WHERE file_id IN " +
                        "    (SELECT id FROM code_files WHERE codebase_id = :codebaseId)))", nativeQuery = true)
        int deleteByCodebaseId(@Param("codebaseId") Long codebaseId);
}
