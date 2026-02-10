package com.astramind.service;

import com.astramind.dto.GitHubRepository;
import com.astramind.model.CodeFile;
import com.astramind.model.CodebaseMetadata;
import com.astramind.model.User;
import com.astramind.repository.CodeFileRepository;
import com.astramind.repository.CodebaseMetadataRepository;
import com.astramind.repository.UserRepository;
import com.astramind.repository.CodeClassRepository;
import com.astramind.repository.CodeEmbeddingRepository;
import com.astramind.repository.CodeRelationshipRepository;
import com.astramind.repository.CodeMetricsRepository;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.transport.UsernamePasswordCredentialsProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
public class CodeIngestionService {

    private static final Logger logger = LoggerFactory.getLogger(CodeIngestionService.class);

    private static final Set<String> SUPPORTED_EXTENSIONS = Set.of(
            ".java", ".js", ".jsx", ".ts", ".tsx", ".py",
            ".cpp", ".c", ".h", ".hpp", ".go", ".rs", ".rb", ".php");

    private static final long MAX_FILE_SIZE = 1024 * 1024; // 1MB
    private static final String TEMP_DIR = System.getProperty("java.io.tmpdir") + "/astramind/";

    @Autowired
    private CodebaseMetadataRepository codebaseMetadataRepository;

    @Autowired
    private CodeFileRepository codeFileRepository;

    @Autowired
    private CodeClassRepository codeClassRepository;

    @Autowired
    private CodeEmbeddingRepository codeEmbeddingRepository;

    @Autowired
    private CodeRelationshipRepository codeRelationshipRepository;

    @Autowired
    private CodeMetricsRepository codeMetricsRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private GitHubOAuthService gitHubOAuthService;

    @Autowired
    private GitHubApiService gitHubApiService;

    /**
     * Start ingestion of a GitHub repository
     */
    @Async
    public void ingestRepository(String userId, String owner, String repoName) {
        logger.info("Starting ingestion for repository: {}/{} by user: {}", owner, repoName, userId);

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Create codebase metadata entry
        CodebaseMetadata codebase = new CodebaseMetadata();
        codebase.setUserId(user.getId());
        codebase.setName(repoName);
        codebase.setGithubUrl("https://github.com/" + owner + "/" + repoName);
        codebase.setStatus("CLONING");
        codebase = codebaseMetadataRepository.save(codebase);

        try {
            // Get repository details
            GitHubRepository repoDetails = gitHubApiService.getRepository(user, owner, repoName);
            codebase.setDescription(repoDetails.getDescription());
            codebase.setPrimaryLanguage(repoDetails.getLanguage() != null ? repoDetails.getLanguage() : "Unknown");
            codebaseMetadataRepository.save(codebase);

            // Clone repository
            String localPath = cloneRepository(user, owner, repoName, codebase.getId());
            codebase.setLocalPath(localPath);
            codebase.setStatus("PROCESSING");
            codebaseMetadataRepository.save(codebase);

            // Extract and process files
            List<CodeFile> codeFiles = extractCodeFiles(new File(localPath), codebase);
            codeFileRepository.saveAll(codeFiles);

            // Update metadata
            codebase.setFileCount(codeFiles.size());
            codebase.setStatus("COMPLETED");
            codebaseMetadataRepository.save(codebase);

            logger.info("Successfully ingested repository: {}/{} with {} files",
                    owner, repoName, codeFiles.size());

        } catch (Exception e) {
            logger.error("Error ingesting repository: {}/{}", owner, repoName, e);
            codebase.setStatus("FAILED");
            codebase.setErrorMessage(e.getMessage());
            codebaseMetadataRepository.save(codebase);
        }
    }

    /**
     * Clone repository using JGit
     */
    private String cloneRepository(User user, String owner, String repoName, String codebaseId)
            throws GitAPIException, IOException {

        String cloneUrl = "https://github.com/" + owner + "/" + repoName + ".git";
        String localPath = TEMP_DIR + codebaseId + "/" + repoName;

        // Create directory if it doesn't exist
        Files.createDirectories(Paths.get(localPath));

        // Get decrypted access token
        String accessToken = gitHubOAuthService.decryptToken(user.getEncryptedAccessToken());

        logger.info("Cloning repository from: {} to: {}", cloneUrl, localPath);

        // Clone repository (Shallow clone for memory efficiency)
        Git.cloneRepository()
                .setURI(cloneUrl)
                .setDirectory(new File(localPath))
                .setCredentialsProvider(new UsernamePasswordCredentialsProvider(accessToken, ""))
                .setDepth(1) // Shallow clone - only latest commit
                .setCloneAllBranches(false) // Only default branch
                .setNoTags() // Don't fetch tags
                .call()
                .close();

        return localPath;
    }

    /**
     * Extract code files from cloned repository
     */
    private List<CodeFile> extractCodeFiles(File directory, CodebaseMetadata codebase) throws IOException {
        List<CodeFile> codeFiles = new ArrayList<>();

        try (Stream<Path> paths = Files.walk(directory.toPath())) {
            paths.filter(Files::isRegularFile)
                    .filter(this::isSupportedFile)
                    .filter(this::isWithinSizeLimit)
                    .filter(path -> !isGitFile(path))
                    .forEach(path -> {
                        try {
                            CodeFile codeFile = createCodeFile(path, directory.toPath(), codebase);
                            if (codeFile != null) {
                                codeFiles.add(codeFile);
                            }
                        } catch (IOException e) {
                            logger.warn("Error processing file: {}", path, e);
                        }
                    });
        }

        logger.info("Extracted {} code files from repository", codeFiles.size());
        return codeFiles;
    }

    /**
     * Create CodeFile entity from file path
     */
    private CodeFile createCodeFile(Path filePath, Path basePath, CodebaseMetadata codebase) throws IOException {
        String relativePath = basePath.relativize(filePath).toString();
        String content = Files.readString(filePath);
        String language = detectLanguage(filePath.toString());

        CodeFile codeFile = new CodeFile();
        codeFile.setCodebaseId(codebase.getId());
        codeFile.setFilePath(relativePath);
        codeFile.setContent(content);
        codeFile.setLanguage(language);
        codeFile.setLineCount(content.split("\n").length);

        return codeFile;
    }

    /**
     * Detect programming language from file extension
     */
    private String detectLanguage(String filePath) {
        String extension = filePath.substring(filePath.lastIndexOf('.'));
        return switch (extension) {
            case ".java" -> "Java";
            case ".js" -> "JavaScript";
            case ".jsx" -> "JavaScript";
            case ".ts" -> "TypeScript";
            case ".tsx" -> "TypeScript";
            case ".py" -> "Python";
            case ".cpp", ".cc" -> "C++";
            case ".c" -> "C";
            case ".h", ".hpp" -> "C/C++ Header";
            case ".go" -> "Go";
            case ".rs" -> "Rust";
            case ".rb" -> "Ruby";
            case ".php" -> "PHP";
            default -> "Unknown";
        };
    }

    /**
     * Check if file is supported
     */
    private boolean isSupportedFile(Path path) {
        String fileName = path.toString().toLowerCase();
        return SUPPORTED_EXTENSIONS.stream().anyMatch(fileName::endsWith);
    }

    /**
     * Check if file is within size limit
     */
    private boolean isWithinSizeLimit(Path path) {
        try {
            return Files.size(path) <= MAX_FILE_SIZE;
        } catch (IOException e) {
            return false;
        }
    }

    /**
     * Check if file is a git file
     */
    private boolean isGitFile(Path path) {
        return path.toString().contains(".git" + File.separator);
    }

    /**
     * Get codebase by ID
     */
    public CodebaseMetadata getCodebase(String codebaseId) {
        return codebaseMetadataRepository.findById(codebaseId)
                .orElseThrow(() -> new RuntimeException("Codebase not found"));
    }

    /**
     * Get all codebases for a user
     */
    public List<CodebaseMetadata> getUserCodebases(String userId) {
        return codebaseMetadataRepository.findByUserIdOrderByUploadedAtDesc(userId);
    }

    /**
     * Get all files for a codebase (file tree structure)
     */
    public List<Map<String, Object>> getCodebaseFiles(String codebaseId) {
        List<CodeFile> files = codeFileRepository.findByCodebaseId(codebaseId);

        return files.stream().map(file -> {
            Map<String, Object> fileInfo = new HashMap<>();
            fileInfo.put("id", file.getId());
            fileInfo.put("path", file.getFilePath());
            fileInfo.put("language", file.getLanguage());
            fileInfo.put("lineCount", file.getLineCount());
            return fileInfo;
        }).collect(Collectors.toList());
    }

    /**
     * Get specific file content
     */
    public Map<String, Object> getFileContent(String fileId, String codebaseId) {
        CodeFile file = codeFileRepository.findById(fileId)
                .orElseThrow(() -> new RuntimeException("File not found"));

        // Verify file belongs to the codebase
        if (!file.getCodebaseId().equals(codebaseId)) {
            throw new RuntimeException("File does not belong to this codebase");
        }

        Map<String, Object> fileData = new HashMap<>();
        fileData.put("id", file.getId());
        fileData.put("path", file.getFilePath());
        fileData.put("content", file.getContent());
        fileData.put("language", file.getLanguage());
        fileData.put("lineCount", file.getLineCount());

        return fileData;
    }

    /**
     * Delete codebase and cleanup all related data
     */
    public void deleteCodebase(String codebaseId) {
        CodebaseMetadata codebase = getCodebase(codebaseId);
        logger.info("Starting deletion of codebase: {} (ID: {})", codebase.getName(), codebaseId);

        // Delete files from disk first
        if (codebase.getLocalPath() != null) {
            try {
                Files.walk(Paths.get(codebase.getLocalPath()))
                        .sorted(Comparator.reverseOrder())
                        .map(Path::toFile)
                        .forEach(File::delete);
                logger.info("Deleted local files for codebase: {}", codebaseId);
            } catch (IOException e) {
                logger.warn("Error deleting codebase files: {}", codebase.getLocalPath(), e);
            }
        }

        // Delete all related data from database
        // Note: Methods and fields are now embedded in classes, so they'll be deleted
        // automatically

        // 1. Delete embeddings
        List<CodeFile> files = codeFileRepository.findByCodebaseId(codebaseId);
        int embeddingsDeleted = 0;
        for (CodeFile file : files) {
            embeddingsDeleted += codeEmbeddingRepository.deleteByCodeFileId(file.getId());
        }
        logger.info("Deleted {} embeddings for codebase: {}", embeddingsDeleted, codebaseId);

        // 2. Delete relationships
        int relationshipsDeleted = 0;
        for (CodeFile file : files) {
            List<com.astramind.model.CodeClass> classes = codeClassRepository.findByFileId(file.getId());
            for (com.astramind.model.CodeClass codeClass : classes) {
                relationshipsDeleted += codeRelationshipRepository.deleteBySourceClassId(codeClass.getId());
            }
        }
        logger.info("Deleted {} relationships for codebase: {}", relationshipsDeleted, codebaseId);

        // 3. Delete classes (methods and fields are embedded, so they're deleted
        // automatically)
        int classesDeleted = 0;
        for (CodeFile file : files) {
            classesDeleted += codeClassRepository.deleteByFileId(file.getId());
        }
        logger.info("Deleted {} classes for codebase: {}", classesDeleted, codebaseId);

        // 4. Delete metrics
        int metricsDeleted = codeMetricsRepository.deleteByCodebaseId(codebaseId);
        logger.info("Deleted {} metrics for codebase: {}", metricsDeleted, codebaseId);

        // 5. Delete files
        int filesDeleted = codeFileRepository.deleteByCodebaseId(codebaseId);
        logger.info("Deleted {} files for codebase: {}", filesDeleted, codebaseId);

        // 6. Finally delete the codebase metadata
        codebaseMetadataRepository.delete(codebase);

        logger.info(
                "Successfully deleted codebase: {} (ID: {}) - Total: {} embeddings, {} relationships, {} classes, {} metrics, {} files",
                codebase.getName(), codebaseId, embeddingsDeleted, relationshipsDeleted, classesDeleted, metricsDeleted,
                filesDeleted);
    }
}
