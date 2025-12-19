package com.astramind.service;

import com.astramind.model.*;
import com.astramind.repository.*;
import com.github.javaparser.JavaParser;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.body.*;
import com.github.javaparser.ast.type.ClassOrInterfaceType;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@Slf4j
public class ASTParserService {

    @Autowired
    private CodeClassRepository codeClassRepository;

    @Autowired
    private CodeMethodRepository codeMethodRepository;

    @Autowired
    private CodeFieldRepository codeFieldRepository;

    @Autowired
    private CodeFileRepository codeFileRepository;

    @Autowired
    private CodeRelationshipRepository codeRelationshipRepository;

    @Autowired
    private CodebaseMetadataRepository codebaseMetadataRepository;

    private final JavaParser javaParser = new JavaParser();

    /**
     * Parse a single Java file and extract code structure
     */
    @Transactional
    public void parseJavaFile(CodeFile file) {
        try {
            log.info("Parsing file: {}", file.getFilePath());

            // Parse the Java code
            var parseResult = javaParser.parse(file.getContent());

            if (!parseResult.isSuccessful()) {
                log.warn("Failed to parse file: {}", file.getFilePath());
                return;
            }

            CompilationUnit cu = parseResult.getResult().get();

            // Extract package name
            String packageName = cu.getPackageDeclaration()
                    .map(pd -> pd.getNameAsString())
                    .orElse(null);

            // Extract all classes and interfaces
            cu.findAll(ClassOrInterfaceDeclaration.class).forEach(classDecl -> {
                CodeClass codeClass = extractClass(classDecl, file, packageName);
                codeClassRepository.save(codeClass);

                // Extract relationships for this class
                extractRelationships(cu, classDecl, codeClass);

                log.debug("Extracted class: {}", codeClass.getFullyQualifiedName());
            });

        } catch (Exception e) {
            log.error("Error parsing file {}: {}", file.getFilePath(), e.getMessage(), e);
        }
    }

    /**
     * Parse all Java files in a codebase
     */
    @Transactional
    public void parseCodebase(Long codebaseId) {
        log.info("Starting AST parsing for codebase: {}", codebaseId);

        try {
            List<CodeFile> javaFiles = codeFileRepository.findByCodebaseId(codebaseId)
                    .stream()
                    .filter(f -> "Java".equalsIgnoreCase(f.getLanguage()))
                    .collect(Collectors.toList());

            log.info("Found {} Java files to parse", javaFiles.size());

            int parsed = 0;
            for (CodeFile file : javaFiles) {
                parseJavaFile(file);
                parsed++;
                if (parsed % 10 == 0) {
                    log.info("Parsed {}/{} files", parsed, javaFiles.size());
                }
            }

            log.info("Completed AST parsing for codebase: {}. Parsed {} files", codebaseId, parsed);

            // Mark codebase as parsed
            Optional<CodebaseMetadata> codebaseOpt = codebaseMetadataRepository.findById(codebaseId);
            if (codebaseOpt.isPresent()) {
                CodebaseMetadata codebase = codebaseOpt.get();
                codebase.setIsParsed(true);
                codebaseMetadataRepository.save(codebase);
                log.info("Marked codebase {} as parsed", codebaseId);
            }
        } catch (Exception e) {
            log.error("Error during AST parsing for codebase {}: {}", codebaseId, e.getMessage(), e);
            throw e; // Re-throw to ensure isParsed stays false on failure
        }
    }

    /**
     * Extract class information
     */
    private CodeClass extractClass(ClassOrInterfaceDeclaration classDecl, CodeFile file, String packageName) {
        CodeClass codeClass = new CodeClass();
        codeClass.setFile(file);
        codeClass.setName(classDecl.getNameAsString());
        codeClass.setPackageName(packageName);

        // Build fully qualified name
        String fqn = packageName != null
                ? packageName + "." + classDecl.getNameAsString()
                : classDecl.getNameAsString();
        codeClass.setFullyQualifiedName(fqn);

        codeClass.setIsInterface(classDecl.isInterface());
        codeClass.setIsAbstract(classDecl.isAbstract());

        // Get extends class
        classDecl.getExtendedTypes().stream()
                .findFirst()
                .ifPresent(ext -> codeClass.setExtendsClass(ext.getNameAsString()));

        // Get line numbers
        classDecl.getBegin().ifPresent(pos -> codeClass.setStartLine(pos.line));
        classDecl.getEnd().ifPresent(pos -> codeClass.setEndLine(pos.line));

        // Extract methods
        List<CodeMethod> methods = new ArrayList<>();
        classDecl.getMethods().forEach(methodDecl -> {
            CodeMethod method = extractMethod(methodDecl, codeClass);
            methods.add(method);
        });
        codeClass.setMethods(methods);

        // Extract fields
        List<CodeField> fields = new ArrayList<>();
        classDecl.getFields().forEach(fieldDecl -> {
            fieldDecl.getVariables().forEach(var -> {
                CodeField field = extractField(var, fieldDecl, codeClass);
                fields.add(field);
            });
        });
        codeClass.setFields(fields);

        return codeClass;
    }

    /**
     * Extract method information
     */
    private CodeMethod extractMethod(MethodDeclaration methodDecl, CodeClass codeClass) {
        CodeMethod method = new CodeMethod();
        method.setCodeClass(codeClass);
        method.setName(methodDecl.getNameAsString());
        method.setReturnType(methodDecl.getTypeAsString());
        method.setIsStatic(methodDecl.isStatic());
        method.setIsPublic(methodDecl.isPublic());

        // Extract parameters
        String params = methodDecl.getParameters().stream()
                .map(p -> p.getTypeAsString() + " " + p.getNameAsString())
                .collect(Collectors.joining(", "));
        method.setParameters(params);

        // Get line numbers
        methodDecl.getBegin().ifPresent(pos -> method.setStartLine(pos.line));
        methodDecl.getEnd().ifPresent(pos -> method.setEndLine(pos.line));

        return method;
    }

    /**
     * Extract field information
     */
    private CodeField extractField(VariableDeclarator var, FieldDeclaration fieldDecl, CodeClass codeClass) {
        CodeField field = new CodeField();
        field.setCodeClass(codeClass);
        field.setName(var.getNameAsString());
        field.setType(var.getTypeAsString());
        field.setIsStatic(fieldDecl.isStatic());
        field.setIsFinal(fieldDecl.isFinal());

        // Get line number
        var.getBegin().ifPresent(pos -> field.setLineNumber(pos.line));

        return field;
    }

    /**
     * Get all classes for a codebase
     */
    public List<CodeClass> getCodebaseClasses(Long codebaseId) {
        return codeClassRepository.findByFile_Codebase_Id(codebaseId);
    }

    /**
     * Get methods for a class
     */
    public List<CodeMethod> getClassMethods(Long classId) {
        return codeMethodRepository.findByCodeClassId(classId);
    }

    /**
     * Get fields for a class
     */
    public List<CodeField> getClassFields(Long classId) {
        return codeFieldRepository.findByCodeClassId(classId);
    }

    /**
     * Extract relationships (imports, extends, implements) for a class
     */
    private void extractRelationships(CompilationUnit cu, ClassOrInterfaceDeclaration classDecl, CodeClass codeClass) {
        try {
            // Extract imports
            cu.getImports().forEach(importDecl -> {
                CodeRelationship relationship = new CodeRelationship();
                relationship.setSourceClass(codeClass);
                relationship.setRelationshipType("IMPORTS");
                relationship.setTargetClassName(importDecl.getNameAsString());
                codeRelationshipRepository.save(relationship);
            });

            // Extract extends relationships
            classDecl.getExtendedTypes().forEach(extendedType -> {
                CodeRelationship relationship = new CodeRelationship();
                relationship.setSourceClass(codeClass);
                relationship.setRelationshipType("EXTENDS");
                relationship.setTargetClassName(extendedType.getNameAsString());
                classDecl.getBegin().ifPresent(pos -> relationship.setLineNumber(pos.line));
                codeRelationshipRepository.save(relationship);
            });

            // Extract implements relationships
            classDecl.getImplementedTypes().forEach(implementedType -> {
                CodeRelationship relationship = new CodeRelationship();
                relationship.setSourceClass(codeClass);
                relationship.setRelationshipType("IMPLEMENTS");
                relationship.setTargetClassName(implementedType.getNameAsString());
                classDecl.getBegin().ifPresent(pos -> relationship.setLineNumber(pos.line));
                codeRelationshipRepository.save(relationship);
            });

            // Extract field type usage (USES relationship)
            classDecl.getFields().forEach(fieldDecl -> {
                String fieldType = fieldDecl.getCommonType().asString();
                // Only track non-primitive types
                if (!isPrimitiveType(fieldType)) {
                    CodeRelationship relationship = new CodeRelationship();
                    relationship.setSourceClass(codeClass);
                    relationship.setRelationshipType("USES");
                    relationship.setTargetClassName(fieldType);
                    fieldDecl.getBegin().ifPresent(pos -> relationship.setLineNumber(pos.line));
                    codeRelationshipRepository.save(relationship);
                }
            });

        } catch (Exception e) {
            log.error("Error extracting relationships for class {}: {}", codeClass.getName(), e.getMessage());
        }
    }

    /**
     * Check if a type is a primitive type
     */
    private boolean isPrimitiveType(String type) {
        return type.equals("int") || type.equals("long") || type.equals("double") ||
                type.equals("float") || type.equals("boolean") || type.equals("char") ||
                type.equals("byte") || type.equals("short") || type.equals("String") ||
                type.equals("void");
    }
}
