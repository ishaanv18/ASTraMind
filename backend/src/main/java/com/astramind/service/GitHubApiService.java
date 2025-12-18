package com.astramind.service;

import com.astramind.dto.GitHubRepository;
import com.astramind.model.User;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class GitHubApiService {

    private final GitHubOAuthService oauthService;
    private final WebClient.Builder webClientBuilder;
    private final ObjectMapper objectMapper;

    private static final String GITHUB_API_BASE_URL = "https://api.github.com";

    /**
     * List user's repositories
     */
    public List<GitHubRepository> listUserRepositories(User user) {
        try {
            String accessToken = oauthService.decryptToken(user.getEncryptedAccessToken());
            WebClient webClient = webClientBuilder.build();

            String response = webClient.get()
                    .uri(GITHUB_API_BASE_URL + "/user/repos?per_page=100&sort=updated")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            List<JsonNode> repoNodes = objectMapper.readValue(response, new TypeReference<>() {
            });
            List<GitHubRepository> repositories = new ArrayList<>();

            for (JsonNode repoNode : repoNodes) {
                GitHubRepository repo = new GitHubRepository();
                repo.setId(repoNode.get("id").asLong());
                repo.setName(repoNode.get("name").asText());
                repo.setFullName(repoNode.get("full_name").asText());

                // Extract owner from full_name (format: "owner/repo")
                String fullName = repoNode.get("full_name").asText();
                if (fullName.contains("/")) {
                    repo.setOwner(fullName.split("/")[0]);
                }

                if (repoNode.has("description") && !repoNode.get("description").isNull()) {
                    repo.setDescription(repoNode.get("description").asText());
                }
                if (repoNode.has("language") && !repoNode.get("language").isNull()) {
                    repo.setLanguage(repoNode.get("language").asText());
                }
                repo.setHtmlUrl(repoNode.get("html_url").asText());
                repo.setCloneUrl(repoNode.get("clone_url").asText());
                repo.setStargazersCount(repoNode.get("stargazers_count").asInt());
                repo.setForksCount(repoNode.get("forks_count").asInt());
                repo.setDefaultBranch(repoNode.get("default_branch").asText());
                repo.setIsPrivate(repoNode.get("private").asBoolean());
                repositories.add(repo);
            }

            return repositories;
        } catch (Exception e) {
            log.error("Error listing repositories", e);
            throw new RuntimeException("Failed to list repositories", e);
        }
    }

    /**
     * Get repository details
     */
    public GitHubRepository getRepository(User user, String owner, String repo) {
        try {
            String accessToken = oauthService.decryptToken(user.getEncryptedAccessToken());
            WebClient webClient = webClientBuilder.build();

            String response = webClient.get()
                    .uri(GITHUB_API_BASE_URL + "/repos/" + owner + "/" + repo)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            JsonNode node = objectMapper.readTree(response);

            GitHubRepository repository = new GitHubRepository();
            repository.setId(node.get("id").asLong());
            repository.setName(node.get("name").asText());
            repository.setFullName(node.get("full_name").asText());

            // Extract owner from full_name (format: "owner/repo")
            String fullName = node.get("full_name").asText();
            if (fullName.contains("/")) {
                repository.setOwner(fullName.split("/")[0]);
            }

            if (node.has("description") && !node.get("description").isNull()) {
                repository.setDescription(node.get("description").asText());
            }
            if (node.has("language") && !node.get("language").isNull()) {
                repository.setLanguage(node.get("language").asText());
            }
            repository.setHtmlUrl(node.get("html_url").asText());
            repository.setCloneUrl(node.get("clone_url").asText());
            repository.setStargazersCount(node.get("stargazers_count").asInt());
            repository.setForksCount(node.get("forks_count").asInt());
            repository.setDefaultBranch(node.get("default_branch").asText());
            repository.setIsPrivate(node.get("private").asBoolean());

            return repository;
        } catch (Exception e) {
            log.error("Error getting repository details", e);
            throw new RuntimeException("Failed to get repository details", e);
        }
    }
}
