package com.pedalmap.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

import org.junit.Test;

public class GpxContentReaderTest {
    @Test
    public void readsValidUtf8WithoutChangingContent() throws Exception {
        String gpx = "<?xml version=\"1.0\"?><name>Peña y ruta</name>";
        assertEquals(gpx, GpxContentReader.read(
                new ByteArrayInputStream(gpx.getBytes(StandardCharsets.UTF_8)),
                1024));
    }

    @Test
    public void acceptsContentExactlyAtTheByteLimit() throws Exception {
        byte[] content = "12345".getBytes(StandardCharsets.UTF_8);
        assertEquals("12345", GpxContentReader.read(new ByteArrayInputStream(content), 5));
    }

    @Test
    public void rejectsContentExceedingTheByteLimitInsteadOfReturningTruncatedData() throws Exception {
        byte[] content = "123456".getBytes(StandardCharsets.UTF_8);
        assertNull(GpxContentReader.read(new ByteArrayInputStream(content), 5));
    }

    @Test
    public void rejectsMalformedUtf8() throws Exception {
        byte[] malformed = new byte[] { (byte) 0xC3, (byte) 0x28 };
        assertNull(GpxContentReader.read(new ByteArrayInputStream(malformed), 16));
    }

    @Test
    public void returnsEmptyStringForEmptyInput() throws Exception {
        assertEquals("", GpxContentReader.read(new ByteArrayInputStream(new byte[0]), 16));
    }
}
