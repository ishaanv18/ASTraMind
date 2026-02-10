package com.astramind.repository;

import com.astramind.model.CodeClass;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CodeClassRepository extends MongoRepository<CodeClass, String> {
        List<CodeClass> findByFileId(String fileId);

        int deleteByFileId(String fileId);
}
