package com.astramind.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "code_classes")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CodeClass {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "file_id", nullable = false)
    private CodeFile file;

    @Column(nullable = false)
    private String name;

    @Column(name = "package_name", length = 500)
    private String packageName;

    @Column(name = "fully_qualified_name", length = 500)
    private String fullyQualifiedName;

    @Column(name = "is_interface")
    private Boolean isInterface = false;

    @Column(name = "is_abstract")
    private Boolean isAbstract = false;

    @Column(name = "extends_class", length = 500)
    private String extendsClass;

    @Column(name = "start_line")
    private Integer startLine;

    @Column(name = "end_line")
    private Integer endLine;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "codeClass", cascade = CascadeType.ALL, orphanRemoval = true)
    @org.hibernate.annotations.BatchSize(size = 25)
    private List<CodeMethod> methods = new ArrayList<>();

    @OneToMany(mappedBy = "codeClass", cascade = CascadeType.ALL, orphanRemoval = true)
    @org.hibernate.annotations.BatchSize(size = 25)
    private List<CodeField> fields = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
