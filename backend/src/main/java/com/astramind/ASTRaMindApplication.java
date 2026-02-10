package com.astramind;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class ASTRaMindApplication {

    public static void main(String[] args) {
        SpringApplication.run(ASTRaMindApplication.class, args);
    }
}
