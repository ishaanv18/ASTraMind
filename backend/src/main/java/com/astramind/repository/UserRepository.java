package com.astramind.repository;

import com.astramind.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface UserRepository extends MongoRepository<User, String> {
    Optional<User> findByGithubId(Long githubId);

    Optional<User> findByUsername(String username);
}
