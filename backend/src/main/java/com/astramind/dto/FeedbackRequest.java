package com.astramind.dto;

import lombok.Data;

@Data
public class FeedbackRequest {
    private Integer rating; // 1-5 stars
    private String emoji; // Emoji reaction
    private String text; // Optional feedback text
    private String username; // User who submitted feedback
}
