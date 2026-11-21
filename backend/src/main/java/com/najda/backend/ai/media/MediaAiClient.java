package com.najda.backend.ai.media;

import com.najda.backend.ai.llm.OpenRouterClient;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Component;

/** Turns audio and images into plain text with OpenRouter multimodal models. */
@Component
public class MediaAiClient {

    private static final String NO_SPEECH = "NO_SPEECH";
    private static final String NOTHING_RELEVANT = "NOTHING_RELEVANT";

    private static final String TRANSCRIBE_SYSTEM = """
            You are a speech transcription engine for an emergency dispatch system.
            Transcribe the audio exactly as spoken, in the language that is spoken. The speaker may use Arabic
            (including Egyptian dialect), English, or a mix of both. Keep Arabic in Arabic script. Do not translate.
            Include everything said, even fragments, panicked speech and background voices that are clearly audible.
            Do not summarise, explain, or add anything that was not said.
            Output ONLY the transcript text. If there is no intelligible speech, output exactly: NO_SPEECH
            """;

    private static final String DESCRIBE_SYSTEM = """
            You describe photos attached to an emergency report, for an emergency dispatcher.
            In 2 to 4 short factual sentences in English, state only what is visible and relevant to the emergency:
            injuries or bleeding, how many people and their apparent condition (conscious, lying down, trapped),
            fire, smoke, vehicles and damage, weapons, hazards, and any location clues such as street signs,
            shop names or landmarks.
            Never identify or guess who anyone is. Do not speculate beyond what you can see.
            If the photo shows nothing relevant to an emergency, output exactly: NOTHING_RELEVANT
            """;

    private final OpenRouterClient llm;
    private final MediaAiProperties props;

    public MediaAiClient(OpenRouterClient llm, MediaAiProperties props) {
        this.llm = llm;
        this.props = props;
    }

    /**
     * @param format audio container: "mp3", "wav", ...
     * @return the transcript, or an empty string when there is no intelligible speech
     */
    public String transcribe(byte[] audio, String format) throws Exception {
        List<Map<String, Object>> content = List.of(
                Map.of("type", "text", "text", "Transcribe this recording."),
                Map.of("type", "input_audio", "input_audio",
                        Map.of("data", Base64.getEncoder().encodeToString(audio), "format", format.toLowerCase(Locale.ROOT))));
        String answer = llm.chat(props.transcriptionModel(), TRANSCRIBE_SYSTEM, content, 4096)
                .orElseThrow(() -> new IllegalStateException("The transcription model returned no text"));
        return answer.contains(NO_SPEECH) ? "" : answer;
    }

    /** @return a short factual description, or an empty string when the photo is not relevant */
    public String describePhoto(byte[] image, String mimeType) throws Exception {
        String dataUrl = "data:" + mimeType + ";base64," + Base64.getEncoder().encodeToString(image);
        List<Map<String, Object>> content = List.of(
                Map.of("type", "text", "text", "Describe this photo for the dispatcher."),
                Map.of("type", "image_url", "image_url", Map.of("url", dataUrl)));
        String answer = llm.chat(props.visionModel(), DESCRIBE_SYSTEM, content, 2048)
                .orElseThrow(() -> new IllegalStateException("The vision model returned no text"));
        return answer.contains(NOTHING_RELEVANT) ? "" : answer;
    }
}
