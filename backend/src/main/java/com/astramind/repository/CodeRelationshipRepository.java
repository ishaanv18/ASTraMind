package com.astramind.repository;

import com.astramind.model.CodeRelationship;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CodeRelationshipRepository extends JpaRepository<CodeRelationship, Long> {

    List<CodeRelationship> findBySourceClass_Id(Long sourceClassId);

    List<CodeRelationship> findByTargetClassId(Long targetClassId);

    @Query("SELECT r FROM CodeRelationship r WHERE r.sourceClass.file.codebase.id = :codebaseId")
    List<CodeRelationship> findByCodebaseId(@Param("codebaseId") Long codebaseId);

    @Modifying
    @Query(value = "DELETE FROM code_relationships " +
            "WHERE source_class_id IN " +
            "(SELECT id FROM code_classes WHERE file_id IN " +
            "  (SELECT id FROM code_files WHERE codebase_id = :codebaseId))", nativeQuery = true)
    int deleteByCodebaseId(@Param("codebaseId") Long codebaseId);
}
