package com.pedalmap.app;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class GpxIntentValidatorTest {
    @Test
    public void acceptsSupportedGpxMimeForContentUri() {
        assertTrue(GpxIntentValidator.isGpxFile(
                "content", "/document/123", "application/gpx+xml", null));
    }

    @Test
    public void acceptsGpxExtensionWithGenericMime() {
        assertTrue(GpxIntentValidator.isGpxFile(
                "content", "/document/route.GPX", "application/octet-stream", null));
    }

    @Test
    public void normalizesMimeParametersAndCase() {
        assertTrue(GpxIntentValidator.isGpxFile(
                "content", "/document/123", null, "Application/XML; charset=utf-8"));
    }

    @Test
    public void rejectsPdfEvenWhenNameEndsInGpx() {
        assertFalse(GpxIntentValidator.isGpxFile(
                "content", "/document/route.gpx", "application/pdf", null));
    }

    @Test
    public void rejectsUnsupportedIntentPayload() {
        assertFalse(GpxIntentValidator.isGpxFile(
                "content", "/document/random", "image/png", "image/png"));
    }

    @Test
    public void rejectsConflictingDeclaredAndResolvedMimeTypes() {
        assertFalse(GpxIntentValidator.isGpxFile(
                "content", "/document/route.gpx", "application/gpx+xml", "application/pdf"));
    }

    @Test
    public void rejectsRemoteOrUnknownSchemes() {
        assertFalse(GpxIntentValidator.isGpxFile(
                "https", "/route.gpx", "application/gpx+xml", "application/gpx+xml"));
    }

    @Test
    public void rejectsNullUriMetadata() {
        assertFalse(GpxIntentValidator.isGpxFile(null, null, null, null));
    }
}
