package com.astramind.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.Indexed;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Document(collection = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @Id
    private String id;

    @Indexed(unique = true)
    private Long githubId;

    private String username;

    private String email;

    private String avatarUrl;

    private String encryptedAccessToken;

    private LocalDateTime createdAt;

    private LocalDateTime lastLoginAt;

    public void onCreate() {
        createdAt = LocalDateTime.now();
        lastLoginAt = LocalDateTime.now();
    }

    public void onUpdate() {
        lastLoginAt = LocalDateTime.now();
    }
}
