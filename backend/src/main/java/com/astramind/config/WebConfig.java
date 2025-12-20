package com.astramind.config;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private static final Logger logger = LoggerFactory.getLogger(WebConfig.class);

    @Value("${cors.allowed-origins:http://localhost:5173}")
    private String frontendUrl;

    @Value("${backend.url:http://localhost:8080}")
    private String backendUrl;

    @PostConstruct
    public void init() {
        logger.info("===========================================");
        logger.info("WebConfig initialized");
        logger.info("CORS allowed origins: {}", frontendUrl);
        logger.info("Backend URL: {}", backendUrl);
        logger.info("===========================================");
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        logger.info("Configuring CORS mappings for: {}", frontendUrl);

        // Parse allowed origins from environment variable
        String[] origins = frontendUrl.split(",");
        String[] trimmedOrigins = new String[origins.length];
        for (int i = 0; i < origins.length; i++) {
            trimmedOrigins[i] = origins[i].trim();
        }

        registry.addMapping("/**")
                .allowedOriginPatterns(trimmedOrigins)
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);
    }
}
