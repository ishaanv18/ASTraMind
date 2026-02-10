package com.astramind.service;

import com.astramind.dto.GitHubUserInfo;
import com.astramind.model.User;
import com.astramind.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class GitHubOAuthService {

    private final UserRepository userRepository;
    private final WebClient.Builder webClientBuilder;
    private final ObjectMapper objectMapper;

    @Value("${github.oauth.client-id}")
    private String clientId;

    @Value("${github.oauth.client-secret}")
    private String clientSecret;

    @Value("${github.oauth.redirect-uri}")
    private String redirectUri;

    @Value("${github.oauth.authorization-url}")
    private String authorizationUrl;

    @Value("${github.oauth.token-url}")
    private String tokenUrl;

    @Value("${github.oauth.user-info-url}")
    private String userInfoUrl;

    private static final String ENCRYPTION_KEY = "ASTraMind2024Key"; // In production, use secure key management

    /**
     * Generate GitHub OAuth authorization URL
     */
    public String getAuthorizationUrl() {
        return String.format("%s?client_id=%s&redirect_uri=%s&scope=repo,user:email",
                authorizationUrl, clientId, redirectUri);
    }

    /**
     * Exchange authorization code for access token
     */
    public String getAccessToken(String code) {
        try {
            WebClient webClient = webClientBuilder.build();

            Map<String, String> requestBody = new HashMap<>();
            requestBody.put("client_id", clientId);
            requestBody.put("client_secret", clientSecret);
            requestBody.put("code", code);
            requestBody.put("redirect_uri", redirectUri);

            String response = webClient.post()
                    .uri(tokenUrl)
                    .header(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                    .bodyValue(requestBody)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            JsonNode jsonNode = objectMapper.readTree(response);
            return jsonNode.get("access_token").asText();
        } catch (Exception e) {
            log.error("Error getting access token", e);
            throw new RuntimeException("Failed to get access token", e);
        }
    }

    /**
     * Fetch GitHub user information
     */
    public GitHubUserInfo getUserInfo(String accessToken) {
        try {
            WebClient webClient = webClientBuilder.build();

            String response = webClient.get()
                    .uri(userInfoUrl)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            JsonNode jsonNode = objectMapper.readTree(response);

            GitHubUserInfo userInfo = new GitHubUserInfo();
            userInfo.setId(jsonNode.get("id").asLong());
            userInfo.setLogin(jsonNode.get("login").asText());
            userInfo.setEmail(jsonNode.has("email") && !jsonNode.get("email").isNull()
                    ? jsonNode.get("email").asText()
                    : null);
            userInfo.setName(jsonNode.has("name") && !jsonNode.get("name").isNull()
                    ? jsonNode.get("name").asText()
                    : jsonNode.get("login").asText());
            userInfo.setAvatarUrl(jsonNode.get("avatar_url").asText());
            userInfo.setBio(jsonNode.has("bio") && !jsonNode.get("bio").isNull()
                    ? jsonNode.get("bio").asText()
                    : null);
            userInfo.setPublicRepos(jsonNode.get("public_repos").asInt());
            userInfo.setFollowers(jsonNode.get("followers").asInt());
            userInfo.setFollowing(jsonNode.get("following").asInt());

            return userInfo;
        } catch (Exception e) {
            log.error("Error getting user info", e);
            throw new RuntimeException("Failed to get user info", e);
        }
    }

    /**
     * Create or update user in database
     */
    public User createOrUpdateUser(GitHubUserInfo githubUserInfo, String accessToken) {
        User user = userRepository.findByGithubId(githubUserInfo.getId())
                .orElse(new User());

        user.setGithubId(githubUserInfo.getId());
        user.setUsername(githubUserInfo.getLogin());
        user.setEmail(githubUserInfo.getEmail());
        user.setAvatarUrl(githubUserInfo.getAvatarUrl());
        user.setEncryptedAccessToken(encryptToken(accessToken));

        return userRepository.save(user);
    }

    /**
     * Encrypt GitHub access token
     */
    private String encryptToken(String token) {
        try {
            SecretKeySpec secretKey = new SecretKeySpec(
                    ENCRYPTION_KEY.getBytes(StandardCharsets.UTF_8), "AES");
            Cipher cipher = Cipher.getInstance("AES");
            cipher.init(Cipher.ENCRYPT_MODE, secretKey);
            byte[] encrypted = cipher.doFinal(token.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(encrypted);
        } catch (Exception e) {
            log.error("Error encrypting token", e);
            throw new RuntimeException("Failed to encrypt token", e);
        }
    }

    /**
     * Decrypt GitHub access token
     */
    public String decryptToken(String encryptedToken) {
        try {
            SecretKeySpec secretKey = new SecretKeySpec(
                    ENCRYPTION_KEY.getBytes(StandardCharsets.UTF_8), "AES");
            Cipher cipher = Cipher.getInstance("AES");
            cipher.init(Cipher.DECRYPT_MODE, secretKey);
            byte[] decrypted = cipher.doFinal(Base64.getDecoder().decode(encryptedToken));
            return new String(decrypted, StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.error("Error decrypting token", e);
            throw new RuntimeException("Failed to decrypt token", e);
        }
    }
}
