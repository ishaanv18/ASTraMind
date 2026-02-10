package com.astramind.repository;

import com.astramind.model.CodeField;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CodeFieldRepository extends JpaRepository<CodeField, Long> {
    List<CodeField> findByCodeClassId(Long classId);

    @Modifying
    @Query(value = "DELETE FROM code_fields " +
            "WHERE class_id IN " +
            "(SELECT id FROM code_classes WHERE file_id IN " +
            "  (SELECT id FROM code_files WHERE codebase_id = :codebaseId))", nativeQuery = true)
    int deleteByCodebaseId(@Param("codebaseId") Long codebaseId);
}
