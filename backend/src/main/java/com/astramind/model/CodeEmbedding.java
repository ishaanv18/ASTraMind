package com.astramind.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "code_embeddings", indexes = {
        @Index(name = "idx_class_id", columnList = "code_class_id"),
        @Index(name = "idx_method_id", columnList = "code_method_id"),
        @Index(name = "idx_embedding_type", columnList = "embedding_type")
})
public class CodeEmbedding {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "code_class_id")
    private CodeClass codeClass;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "code_method_id")
    private CodeMethod codeMethod;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "code_file_id", nullable = false)
    private CodeFile codeFile;

    @Column(name = "code_element_type", nullable = false, length = 50)
    private String codeElementType; // 'CLASS' or 'METHOD' - matches database column name

    @Column(name = "element_name", nullable = false, length = 500)
    private String elementName; // Name of the class or method

    @Column(name = "embedding_type", nullable = false, length = 50)
    private String embeddingType; // 'CLASS' or 'METHOD'

    @Column(name = "embedding", columnDefinition = "TEXT", nullable = false)
    private String embedding; // Stored as string representation of vector

    @Column(name = "text_content", columnDefinition = "TEXT", nullable = false)
    private String textContent;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    // Constructors
    public CodeEmbedding() {
    }

    public CodeEmbedding(CodeClass codeClass, String embeddingType, float[] embeddingVector, String textContent) {
        this.codeClass = codeClass;
        this.embeddingType = embeddingType;
        this.embedding = vectorToString(embeddingVector);
        this.textContent = textContent;
    }

    public CodeEmbedding(CodeMethod codeMethod, String embeddingType, float[] embeddingVector, String textContent) {
        this.codeMethod = codeMethod;
        this.embeddingType = embeddingType;
        this.embedding = vectorToString(embeddingVector);
        this.textContent = textContent;
    }

    // Helper methods to convert between float[] and String
    public static String vectorToString(float[] vector) {
        if (vector == null || vector.length == 0) {
            return "[]";
        }
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < vector.length; i++) {
            sb.append(vector[i]);
            if (i < vector.length - 1) {
                sb.append(",");
            }
        }
        sb.append("]");
        return sb.toString();
    }

    public static float[] stringToVector(String vectorString) {
        if (vectorString == null || vectorString.equals("[]")) {
            return new float[0];
        }
        String[] parts = vectorString.substring(1, vectorString.length() - 1).split(",");
        float[] vector = new float[parts.length];
        for (int i = 0; i < parts.length; i++) {
            vector[i] = Float.parseFloat(parts[i].trim());
        }
        return vector;
    }

    public float[] getEmbeddingVector() {
        return stringToVector(this.embedding);
    }

    public void setEmbeddingVector(float[] vector) {
        this.embedding = vectorToString(vector);
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public CodeClass getCodeClass() {
        return codeClass;
    }

    public void setCodeClass(CodeClass codeClass) {
        this.codeClass = codeClass;
    }

    public CodeMethod getCodeMethod() {
        return codeMethod;
    }

    public void setCodeMethod(CodeMethod codeMethod) {
        this.codeMethod = codeMethod;
    }

    public CodeFile getCodeFile() {
        return codeFile;
    }

    public void setCodeFile(CodeFile codeFile) {
        this.codeFile = codeFile;
    }

    public String getCodeElementType() {
        return codeElementType;
    }

    public void setCodeElementType(String codeElementType) {
        this.codeElementType = codeElementType;
    }

    public String getElementName() {
        return elementName;
    }

    public void setElementName(String elementName) {
        this.elementName = elementName;
    }

    public String getEmbeddingType() {
        return embeddingType;
    }

    public void setEmbeddingType(String embeddingType) {
        this.embeddingType = embeddingType;
    }

    public String getEmbedding() {
        return embedding;
    }

    public void setEmbedding(String embedding) {
        this.embedding = embedding;
    }

    public String getTextContent() {
        return textContent;
    }

    public void setTextContent(String textContent) {
        this.textContent = textContent;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
