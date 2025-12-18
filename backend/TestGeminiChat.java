import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class TestGeminiChat {
    public static void main(String[] args) {
        String apiKey = "AIzaSyAX9Tu2q4PgOVoFR-OQBxVm1KIypykzg9s";
        String url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key="
                + apiKey;

        String requestBody = "{\"contents\":[{\"parts\":[{\"text\":\"hello\"}]}]}";

        try (FileWriter logWriter = new FileWriter("gemini_chat_test_output.txt")) {
            logWriter.write("Testing Gemini Chat API with 'hello'\n");
            logWriter.write("URL: " + url.replace(apiKey, "***") + "\n");
            logWriter.write("Request body: " + requestBody + "\n\n");

            HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setDoOutput(true);

            try (OutputStream os = conn.getOutputStream()) {
                byte[] input = requestBody.getBytes(StandardCharsets.UTF_8);
                os.write(input, 0, input.length);
            }

            int responseCode = conn.getResponseCode();
            logWriter.write("Response Code: " + responseCode + "\n");

            BufferedReader in;
            if (responseCode >= 200 && responseCode < 300) {
                in = new BufferedReader(new InputStreamReader(conn.getInputStream()));
            } else {
                in = new BufferedReader(new InputStreamReader(conn.getErrorStream()));
            }

            String inputLine;
            StringBuilder response = new StringBuilder();
            while ((inputLine = in.readLine()) != null) {
                response.append(inputLine);
            }
            in.close();

            logWriter.write("Response Body:\n" + response.toString() + "\n");
            System.out.println("Chat test complete. Check gemini_chat_test_output.txt");

        } catch (Exception e) {
            try (FileWriter errorWriter = new FileWriter("gemini_chat_test_error.txt")) {
                errorWriter.write("Exception: " + e.getMessage() + "\n");
                e.printStackTrace(new PrintWriter(errorWriter));
            } catch (IOException ioException) {
                ioException.printStackTrace();
            }
        }
    }
}
