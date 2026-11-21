package com.najda.backend.ai.media;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Shrinks and normalises phone media with ffmpeg before it is sent to a model.
 *
 * Why: a minute of 1080p video is tens of MB although the speech in it is under 1 MB, iOS .mov / Android .3gp are
 * formats models reject, and request bodies carrying base64 media must stay small. Every method returns empty when
 * ffmpeg is missing or fails; the caller then decides whether the original file can be sent as it is.
 */
@Component
public class MediaConverter {

    private static final Logger log = LoggerFactory.getLogger(MediaConverter.class);

    /** Audio track (or audio file) -> mono 16 kHz 32 kbps MP3. */
    public Optional<byte[]> toSpeechMp3(byte[] media, String extension) {
        return run(media, extension, "out.mp3",
                "-vn", "-ac", "1", "-ar", "16000", "-c:a", "libmp3lame", "-b:a", "32k");
    }

    /** Any image (or first video frame) -> JPEG, at most 1280 px wide. */
    public Optional<byte[]> toSmallJpeg(byte[] media, String extension) {
        return run(media, extension, "out.jpg",
                "-frames:v", "1", "-vf", "scale='min(1280,iw)':-2", "-q:v", "4");
    }

    private Optional<byte[]> run(byte[] media, String extension, String outName, String... options) {
        Path dir = null;
        try {
            dir = Files.createTempDirectory("najda-media-");
            Path in = dir.resolve("in." + extension);
            Path out = dir.resolve(outName);
            Files.write(in, media);

            List<String> command = new ArrayList<>(List.of("ffmpeg", "-nostdin", "-y", "-loglevel", "error", "-i", in.toString()));
            command.addAll(List.of(options));
            command.add(out.toString());

            Process process = new ProcessBuilder(command)
                    .redirectOutput(ProcessBuilder.Redirect.DISCARD)   // never block on a full pipe: the timeout below must work
                    .redirectError(ProcessBuilder.Redirect.DISCARD)
                    .start();

            if (!process.waitFor(60, TimeUnit.SECONDS)) {
                process.destroyForcibly();
                log.warn("ffmpeg timed out converting .{}", extension);
                return Optional.empty();
            }
            if (process.exitValue() != 0 || !Files.exists(out)) {
                log.warn("ffmpeg could not convert .{} (exit {})", extension, process.exitValue());
                return Optional.empty();
            }
            return Optional.of(Files.readAllBytes(out));
        } catch (IOException e) {
            log.info("ffmpeg unavailable, using the original file if possible: {}", e.getMessage());
            return Optional.empty();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Optional.empty();
        } finally {
            deleteQuietly(dir);
        }
    }

    private void deleteQuietly(Path dir) {
        if (dir == null) return;
        try (Stream<Path> files = Files.walk(dir)) {
            files.sorted(Comparator.reverseOrder()).forEach(p -> p.toFile().delete());
        } catch (IOException ignored) {
            // temp dir; the OS cleans it eventually
        }
    }
}
