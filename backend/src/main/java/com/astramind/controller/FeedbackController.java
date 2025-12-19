package com.astramind.controller;

import com.astramind.dto.FeedbackRequest;
import com.astramind.service.EmailService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/feedback")
@Slf4j
public class FeedbackController {

    @Autowired
    private EmailService emailService;

    @PostMapping
    public ResponseEntity<?> submitFeedback(@RequestBody FeedbackRequest feedback) {
        try {
            log.info("Received feedback: rating={}, emoji={}, hasText={}",
                    feedback.getRating(), feedback.getEmoji(), feedback.getText() != null);

            emailService.sendFeedbackEmail(feedback);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Thank you for your feedback!"));
        } catch (Exception e) {
            log.error("Error submitting feedback", e);
            return ResponseEntity.status(500).body(Map.of(
                    "success", false,
                    "message", "Failed to submit feedback"));
        }
    }
}
