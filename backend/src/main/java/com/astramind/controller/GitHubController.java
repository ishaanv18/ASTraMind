package com.astramind.controller;

import com.astramind.dto.GitHubRepository;
import com.astramind.model.User;
import com.astramind.service.GitHubApiService;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/github")
@CrossOrigin(origins = { "http://localhost:3000", "http://localhost:5173" }, allowCredentials = "true")
public class GitHubController {

    @Autowired
    private GitHubApiService gitHubApiService;

    /**
     * List user's repositories
     */
    @GetMapping("/repositories")
    public ResponseEntity<?> listRepositories(HttpSession session) {
        User user = (User) session.getAttribute("user");
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        try {
            List<GitHubRepository> repositories = gitHubApiService.listUserRepositories(user);
            return ResponseEntity.ok(repositories);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Get repository details
     */
    @GetMapping("/repositories/{owner}/{repo}")
    public ResponseEntity<?> getRepository(@PathVariable String owner, @PathVariable String repo, HttpSession session) {
        User user = (User) session.getAttribute("user");
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        try {
            GitHubRepository repository = gitHubApiService.getRepository(user, owner, repo);
            return ResponseEntity.ok(repository);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }
}
