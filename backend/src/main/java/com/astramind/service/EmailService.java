package com.astramind.service;

import com.astramind.dto.FeedbackRequest;
import com.sendgrid.*;
import com.sendgrid.helpers.mail.Mail;
import com.sendgrid.helpers.mail.objects.Content;
import com.sendgrid.helpers.mail.objects.Email;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;

@Service
@Slf4j
public class EmailService {

    @Value("${sendgrid.api.key}")
    private String sendGridApiKey;

    @Value("${feedback.recipient.email}")
    private String recipientEmail;

    @Value("${feedback.from.email:noreply@astramind.com}")
    private String fromEmail;

    public void sendFeedbackEmail(FeedbackRequest feedback) throws IOException {
        Email from = new Email(fromEmail);
        Email to = new Email(recipientEmail);
        String subject = "New Feedback from ASTraMind - Rating: " + getStars(feedback.getRating());

        // Build email content
        StringBuilder contentBuilder = new StringBuilder();
        contentBuilder.append("<h2>New Feedback Received</h2>");
        contentBuilder.append("<p><strong>Rating:</strong> ").append(getStars(feedback.getRating())).append("</p>");
        contentBuilder.append("<p><strong>Emoji Reaction:</strong> ").append(feedback.getEmoji()).append("</p>");

        if (feedback.getUsername() != null) {
            contentBuilder.append("<p><strong>User:</strong> ").append(feedback.getUsername()).append("</p>");
        }

        if (feedback.getText() != null && !feedback.getText().trim().isEmpty()) {
            contentBuilder.append("<h3>Feedback Message:</h3>");
            contentBuilder.append("<p>").append(feedback.getText()).append("</p>");
        }

        Content content = new Content("text/html", contentBuilder.toString());
        Mail mail = new Mail(from, subject, to, content);

        SendGrid sg = new SendGrid(sendGridApiKey);
        Request request = new Request();

        try {
            request.setMethod(Method.POST);
            request.setEndpoint("mail/send");
            request.setBody(mail.build());
            Response response = sg.api(request);

            if (response.getStatusCode() >= 200 && response.getStatusCode() < 300) {
                log.info("Email sent successfully. Status: {}", response.getStatusCode());
            } else {
                log.error("SendGrid returned error. Status: {}, Body: {}",
                        response.getStatusCode(), response.getBody());
                if (response.getStatusCode() == 403) {
                    log.error("403 Forbidden - Please verify your sender email in SendGrid: {}", fromEmail);
                    log.error("Visit: https://app.sendgrid.com/settings/sender_auth/senders");
                }
                throw new IOException("SendGrid API error: " + response.getStatusCode());
            }
        } catch (IOException ex) {
            log.error("Error sending email via SendGrid", ex);
            throw ex;
        }
    }

    private String getStars(Integer rating) {
        if (rating == null)
            return "No rating";
        StringBuilder stars = new StringBuilder();
        for (int i = 0; i < rating; i++) {
            stars.append("⭐");
        }
        return stars.toString();
    }
}
