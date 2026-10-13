package com.pedalmap.app;

import java.util.Locale;

/** Validates inbound GPX URI metadata before MainActivity reads the file. */
final class GpxIntentValidator {
    private GpxIntentValidator() {}

    static boolean isGpxFile(
            String scheme,
            String path,
            String declaredMimeType,
            String resolvedMimeType) {
        if (!"content".equals(scheme) && !"file".equals(scheme)) {
            return false;
        }

        if (!allowsExtensionFallback(declaredMimeType)
                && !isSupportedGpxMime(declaredMimeType)) {
            return false;
        }
        if (!allowsExtensionFallback(resolvedMimeType)
                && !isSupportedGpxMime(resolvedMimeType)) {
            return false;
        }

        if (isSupportedGpxMime(declaredMimeType) || isSupportedGpxMime(resolvedMimeType)) {
            return true;
        }

        return path != null && path.toLowerCase(Locale.ROOT).endsWith(".gpx");
    }

    static boolean isSupportedGpxMime(String mimeType) {
        String normalized = normalizeMime(mimeType);
        return "application/gpx+xml".equals(normalized)
                || "text/xml".equals(normalized)
                || "application/xml".equals(normalized);
    }

    private static boolean allowsExtensionFallback(String mimeType) {
        String normalized = normalizeMime(mimeType);
        return normalized == null
                || "application/octet-stream".equals(normalized)
                || "binary/octet-stream".equals(normalized)
                || "text/plain".equals(normalized);
    }

    private static String normalizeMime(String mimeType) {
        if (mimeType == null) return null;
        int parameters = mimeType.indexOf(';');
        String value = parameters >= 0 ? mimeType.substring(0, parameters) : mimeType;
        value = value.trim().toLowerCase(Locale.ROOT);
        return value.isEmpty() ? null : value;
    }
}
