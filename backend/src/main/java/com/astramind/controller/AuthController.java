package com.astramind.controller;

import com.astramind.dto.GitHubUserInfo;
import com.astramind.model.User;
import com.astramind.service.GitHubOAuthService;
import com.astramind.util.JwtUtil;
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
    private final JwtUtil jwtUtil;

    @org.springframework.beans.factory.annotation.Value("${cors.allowed-origins:http://localhost:5173}")
    private String allowedOrigins;

    private String getFrontendUrl() {
        // Extract origins from the comma-separated list
        if (allowedOrigins.contains(",")) {
            String[] origins = allowedOrigins.split(",");
            // Prefer production URL (https) over localhost
            for (String origin : origins) {
                String trimmed = origin.trim();
                if (trimmed.startsWith("https://")) {
                    return trimmed;
                }
            }
            // Fallback to first origin if no https found
            return origins[0].trim();
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

            // Store user in session (for backward compatibility)
            session.setAttribute("user", user);
            session.setAttribute("userId", user.getId());
            session.setAttribute("username", user.getUsername());

            // Generate JWT token
            String token = jwtUtil.generateToken(user.getId(), user.getUsername(), user.getEmail());

            log.info("User {} logged in successfully", user.getUsername());

            // Redirect to frontend dashboard with JWT token
            String redirectUrl = String.format("%s/dashboard?token=%s",
                    getFrontendUrl(),
                    token);

            return ResponseEntity.status(302)
                    .header("Location", redirectUrl)
                    .build();
        } catch (Exception e) {
            log.error("Error during GitHub callback", e);
            return ResponseEntity.status(302)
                    .header("Location", getFrontendUrl() + "/login?error=auth_failed")
                    .build();
        }
    }

    /**
     * Get current user info from JWT token
     */
    @GetMapping("/user")
    public ResponseEntity<?> getCurrentUser(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        // Try JWT first
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            if (jwtUtil.validateToken(token)) {
                Map<String, Object> response = new HashMap<>();
                response.put("userId", jwtUtil.getUserIdFromToken(token));
                response.put("username", jwtUtil.getUsernameFromToken(token));
                response.put("email", jwtUtil.getEmailFromToken(token));
                return ResponseEntity.ok(response);
            }
        }

        // Fallback to session for backward compatibility
        return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
    }

    /**
     * Validate JWT token
     */
    @PostMapping("/validate")
    public ResponseEntity<Map<String, Object>> validateToken(@RequestBody Map<String, String> request) {
        String token = request.get("token");
        Map<String, Object> response = new HashMap<>();

        if (token != null && jwtUtil.validateToken(token)) {
            response.put("valid", true);
            response.put("userId", jwtUtil.getUserIdFromToken(token));
            response.put("username", jwtUtil.getUsernameFromToken(token));
            response.put("email", jwtUtil.getEmailFromToken(token));
            return ResponseEntity.ok(response);
        }

        response.put("valid", false);
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
    public ResponseEntity<Map<String, Boolean>> checkAuthStatus(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            HttpSession session) {
        Map<String, Boolean> response = new HashMap<>();

        // Check JWT token first
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            response.put("authenticated", jwtUtil.validateToken(token));
            return ResponseEntity.ok(response);
        }

        // Fallback to session
        Long userId = (Long) session.getAttribute("userId");
        response.put("authenticated", userId != null);
        return ResponseEntity.ok(response);
    }
}
