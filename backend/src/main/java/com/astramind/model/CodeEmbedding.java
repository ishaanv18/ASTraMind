package com.astramind.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import java.time.LocalDateTime;

@Document(collection = "code_embeddings")
@CompoundIndexes({
        @CompoundIndex(name = "class_idx", def = "{'codeClassId': 1}"),
        @CompoundIndex(name = "method_idx", def = "{'codeMethodId': 1}"),
        @CompoundIndex(name = "type_idx", def = "{'embeddingType': 1}")
})
public class CodeEmbedding {

    @Id
    private String id;

    @Indexed
    private String codeClassId;

    private String codeMethodId;

    @Indexed
    private String codeFileId;

    private String codeElementType; // 'CLASS' or 'METHOD'

    private String elementName;

    private String embeddingType; // 'CLASS' or 'METHOD'

    private String embedding; // Stored as string representation of vector

    private String textContent;

    private LocalDateTime createdAt;

    public void onCreate() {
        createdAt = LocalDateTime.now();
    }

    // Constructors
    public CodeEmbedding() {
    }

    public CodeEmbedding(String codeClassId, String embeddingType, float[] embeddingVector, String textContent) {
        this.codeClassId = codeClassId;
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
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getCodeClassId() {
        return codeClassId;
    }

    public void setCodeClassId(String codeClassId) {
        this.codeClassId = codeClassId;
    }

    public String getCodeMethodId() {
        return codeMethodId;
    }

    public void setCodeMethodId(String codeMethodId) {
        this.codeMethodId = codeMethodId;
    }

    public String getCodeFileId() {
        return codeFileId;
    }

    public void setCodeFileId(String codeFileId) {
        this.codeFileId = codeFileId;
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
