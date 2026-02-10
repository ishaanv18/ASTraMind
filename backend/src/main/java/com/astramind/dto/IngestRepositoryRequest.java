package com.astramind.dto;

import lombok.Data;

@Data
public class IngestRepositoryRequest {
    private String owner;
    private String repo;
}
