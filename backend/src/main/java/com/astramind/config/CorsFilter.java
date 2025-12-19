package com.astramind.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CorsFilter implements Filter {

    private static final Logger logger = LoggerFactory.getLogger(CorsFilter.class);

    @Value("${cors.allowed-origins:http://localhost:5173}")
    private String allowedOrigins;

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {

        HttpServletResponse response = (HttpServletResponse) res;
        HttpServletRequest request = (HttpServletRequest) req;

        String origin = request.getHeader("Origin");

        logger.info("CORS Filter - Request from origin: {}", origin);
        logger.info("CORS Filter - Allowed origins: {}", allowedOrigins);

        // Check if the origin is allowed
        if (origin != null && allowedOrigins.contains(origin)) {
            // Only set the specific origin that made the request
            response.setHeader("Access-Control-Allow-Origin", origin);
            response.setHeader("Access-Control-Allow-Credentials", "true");
            response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
            response.setHeader("Access-Control-Max-Age", "3600");
            response.setHeader("Access-Control-Allow-Headers",
                    "Origin, X-Requested-With, Content-Type, Accept, Authorization, Cookie");
            logger.info("CORS Filter - Allowed origin: {}", origin);
        } else {
            logger.warn("CORS Filter - Origin not allowed: {}", origin);
        }

        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            logger.info("CORS Filter - Handling OPTIONS preflight request");
            response.setStatus(HttpServletResponse.SC_OK);
        } else {
            chain.doFilter(req, res);
        }
    }

    @Override
    public void init(FilterConfig filterConfig) {
        logger.info("===========================================");
        logger.info("CORS Filter initialized");
        logger.info("Allowed origins: {}", allowedOrigins);
        logger.info("===========================================");
    }

    @Override
    public void destroy() {
    }
}
