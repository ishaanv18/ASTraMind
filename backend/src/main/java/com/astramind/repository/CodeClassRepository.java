package com.astramind.repository;

import com.astramind.model.CodeClass;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CodeClassRepository extends JpaRepository<CodeClass, Long> {
        List<CodeClass> findByFileId(Long fileId);

        // Query without JOIN FETCH to avoid MultipleBagFetchException
        // Methods and fields will be lazily loaded when accessed
        @Query("SELECT c FROM CodeClass c WHERE c.file.codebase.id = :codebaseId")
        List<CodeClass> findByFile_Codebase_Id(@Param("codebaseId") Long codebaseId);

        @Modifying
        @Query(value = "DELETE FROM code_classes " +
                        "WHERE file_id IN " +
                        "(SELECT id FROM code_files WHERE codebase_id = :codebaseId)", nativeQuery = true)
        int deleteByCodebaseId(@Param("codebaseId") Long codebaseId);
}
