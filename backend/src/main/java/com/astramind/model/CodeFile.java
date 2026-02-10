package com.astramind.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.Indexed;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Document(collection = "code_files")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CodeFile {

    @Id
    private String id;

    @Indexed
    private String codebaseId;

    private String filePath;

    private String content;

    private String language;

    private String astData;

    private Integer lineCount;

    private Integer classCount;

    private Integer functionCount;
}
