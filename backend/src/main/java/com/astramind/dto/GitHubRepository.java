package com.astramind.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class GitHubRepository {
    private Long id;
    private String name;
    private String owner; // Owner username for ingestion

    @JsonProperty("full_name")
    private String fullName;

    private String description;
    private String language;

    @JsonProperty("html_url")
    private String htmlUrl;

    @JsonProperty("clone_url")
    private String cloneUrl;

    @JsonProperty("stargazers_count")
    private Integer stargazersCount;

    @JsonProperty("forks_count")
    private Integer forksCount;

    @JsonProperty("default_branch")
    private String defaultBranch;

    @JsonProperty("private")
    private Boolean isPrivate;
}
