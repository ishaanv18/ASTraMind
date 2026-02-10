package com.astramind.repository;

import com.astramind.model.CodeRelationship;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CodeRelationshipRepository extends MongoRepository<CodeRelationship, String> {

    List<CodeRelationship> findBySourceClassId(String sourceClassId);

    List<CodeRelationship> findByTargetClassId(String targetClassId);

    int deleteBySourceClassId(String sourceClassId);
}
