package com.pedalmap.app;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;

/** Bounded strict UTF-8 reader used for inbound GPX content. Caller owns the stream. */
final class GpxContentReader {
    private GpxContentReader() {}

    static String read(InputStream inputStream, int maxBytes) throws IOException {
        if (inputStream == null) return null;
        if (maxBytes < 0) throw new IllegalArgumentException("maxBytes must not be negative");

        ByteArrayOutputStream output = new ByteArrayOutputStream(Math.min(maxBytes, 8192));
        byte[] buffer = new byte[8192];
        int len;
        int totalBytes = 0;

        while ((len = inputStream.read(buffer)) != -1) {
            if (totalBytes + len > maxBytes) {
                return null;
            }
            output.write(buffer, 0, len);
            totalBytes += len;
        }

        try {
            return StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(output.toByteArray()))
                    .toString();
        } catch (CharacterCodingException e) {
            return null;
        }
    }
}
