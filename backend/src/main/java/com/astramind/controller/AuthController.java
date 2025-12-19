package com.astramind.controller;

import com.astramind.dto.GitHubUserInfo;
import com.astramind.model.User;
import com.astramind.service.GitHubOAuthService;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Slf4j
public class AuthController {

    private final GitHubOAuthService githubOAuthService;

    @org.springframework.beans.factory.annotation.Value("${cors.allowed-origins:http://localhost:5173}")
    private String allowedOrigins;

    private String getFrontendUrl() {
        // Extract the first origin from the comma-separated list
        if (allowedOrigins.contains(",")) {
            return allowedOrigins.split(",")[1].trim(); // Use second origin (5173) as it's the Vite dev server
        }
        return allowedOrigins;
    }

    /**
     * Redirect to GitHub OAuth
     */
    @GetMapping("/github")
    public ResponseEntity<Map<String, String>> githubLogin() {
        String authUrl = githubOAuthService.getAuthorizationUrl();
        Map<String, String> response = new HashMap<>();
        response.put("authUrl", authUrl);
        return ResponseEntity.ok(response);
    }

    /**
     * GitHub OAuth callback
     */
    @GetMapping("/github/callback")
    public ResponseEntity<String> githubCallback(
            @RequestParam String code,
            HttpSession session) {
        try {
            // Exchange code for access token
            String accessToken = githubOAuthService.getAccessToken(code);

            // Get user info from GitHub
            GitHubUserInfo githubUserInfo = githubOAuthService.getUserInfo(accessToken);

            // Create or update user in database
            User user = githubOAuthService.createOrUpdateUser(githubUserInfo, accessToken);

            // Store user in session
            session.setAttribute("user", user);
            session.setAttribute("userId", user.getId());
            session.setAttribute("username", user.getUsername());

            log.info("User {} logged in successfully", user.getUsername());

            // Redirect to frontend dashboard
            return ResponseEntity.status(302)
                    .header("Location", getFrontendUrl() + "/dashboard")
                    .build();
        } catch (Exception e) {
            log.error("Error during GitHub callback", e);
            return ResponseEntity.status(302)
                    .header("Location", getFrontendUrl() + "/login?error=auth_failed")
                    .build();
        }
    }

    /**
     * Get current user info
     */
    @GetMapping("/user")
    public ResponseEntity<?> getCurrentUser(HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        Map<String, Object> response = new HashMap<>();
        response.put("userId", userId);
        response.put("username", session.getAttribute("username"));
        return ResponseEntity.ok(response);
    }

    /**
     * Logout user
     */
    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(HttpSession session) {
        session.invalidate();
        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }

    /**
     * Check authentication status
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Boolean>> checkAuthStatus(HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");
        Map<String, Boolean> response = new HashMap<>();
        response.put("authenticated", userId != null);
        return ResponseEntity.ok(response);
    }
}
