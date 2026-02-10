package com.astramind.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class GitHubUserInfo {
    private Long id;
    private String login;
    private String email;
    private String name;
    private String avatarUrl;
    private String bio;
    private Integer publicRepos;
    private Integer followers;
    private Integer following;
}
