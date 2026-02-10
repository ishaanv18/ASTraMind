package com.astramind.repository;

import com.astramind.model.CodeMethod;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CodeMethodRepository extends JpaRepository<CodeMethod, Long> {
    List<CodeMethod> findByCodeClassId(Long classId);

    List<CodeMethod> findByCodeClass_File_Codebase_Id(Long codebaseId);

    @Modifying
    @Query(value = "DELETE FROM code_methods " +
            "WHERE class_id IN " +
            "(SELECT id FROM code_classes WHERE file_id IN " +
            "  (SELECT id FROM code_files WHERE codebase_id = :codebaseId))", nativeQuery = true)
    int deleteByCodebaseId(@Param("codebaseId") Long codebaseId);
}
