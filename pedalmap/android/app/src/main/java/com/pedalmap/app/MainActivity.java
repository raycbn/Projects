package com.pedalmap.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.OnBackPressedDispatcher;

import com.getcapacitor.BridgeActivity;
import com.pedalmap.app.plugins.DocumentPickerPlugin;
import com.pedalmap.app.plugins.GoogleSignInPlugin;
import com.pedalmap.app.plugins.LocalNotificationPlugin;
import com.pedalmap.app.plugins.RouteSharePlugin;

import java.io.IOException;
import java.io.InputStream;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Minimal MainActivity: receives VIEW intents (deep links) on the single top
 * task and drives the Capacitor WebView as an in-app SPA navigation.
 *
 * This keeps a single activity/task (no launcher change, no new activities)
 * and never loads a remote URL: it rewrites the current SPA location so
 * React Router (/fuel/*) renders the embedded FuelApp inside the same WebView.
 */
public class MainActivity extends BridgeActivity {

  private static final String TAG = "PedalMap MainActivity";
  private static final int MAX_GPX_FILE_BYTES = 10 * 1024 * 1024;
  private final Set<String> handledIntents = new HashSet<>();
  private final Set<String> handledShortcuts = new HashSet<>();

  // Pending deep link when WebView is not yet ready
  private String pendingDeepLinkTarget = null;
  private String pendingDeepLinkSource = null;
  private int pendingRetryCount = 0;
  private static final int MAX_PENDING_RETRIES = 20;
  private final Handler mainHandler = new Handler(Looper.getMainLooper());

  @Override
  public void onCreate(Bundle savedInstanceState) {
    // Register custom plugins BEFORE super.onCreate() so they're available when Bridge is created
    registerPlugins(Arrays.asList(
      GoogleSignInPlugin.class,
      DocumentPickerPlugin.class,
      LocalNotificationPlugin.class,
      RouteSharePlugin.class
    ));

    super.onCreate(savedInstanceState);

    // Register modern Android Back handler (API 33+) with OnBackPressedDispatcher
    OnBackPressedDispatcher dispatcher = getOnBackPressedDispatcher();
    OnBackPressedCallback backCallback = new OnBackPressedCallback(true) {
      @Override
      public void handleOnBackPressed() {
        Log.d(TAG, "[back] callback invoked");
        if (getBridge() != null && getBridge().getWebView() != null) {
          android.webkit.WebView webView = getBridge().getWebView();
          boolean canGoBack = webView.canGoBack();
          Log.d(TAG, "[back] canGoBack=" + canGoBack);
          if (canGoBack) {
            Log.d(TAG, "[back] action=navigate");
            webView.goBack();
            return;
          }
          // No in-app history: navigate to home SPA instead of finishing
          Log.d(TAG, "[back] action=home");
          webView.loadUrl("https://localhost/");
          return;
        }
        Log.d(TAG, "[back] action=default (no bridge/webview)");
        // Fallback to default behavior (finish activity)
        this.setEnabled(false);
        onBackPressed();
      }
    };
    dispatcher.addCallback(this, backCallback);

    // Handle launch intent AFTER super.onCreate() so Bridge/WebView are initialized
    Intent launchIntent = getIntent();
    if (launchIntent != null) {
      Log.d(TAG, "shortcut onCreate intent");
      handleIntent(launchIntent);
    }

    // If there was a pending deep link from a previous attempt, try to dispatch it now
    if (pendingDeepLinkTarget != null) {
      dispatchPendingDeepLink();
    }
  }

  @Override
  public void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);

    if (intent != null) {
      handleIntent(intent);
    }
  }

  private void handleIntent(Intent intent) {
    if (intent == null) return;
    if (!Intent.ACTION_VIEW.equals(intent.getAction()) && !Intent.ACTION_SEND.equals(intent.getAction())) return;

    // 1. Try URI-based shortcut (pedalmap://shortcut/...)
    Uri data = intent.getData();
    String shortcutId = extractShortcutFromUri(data);
    if (shortcutId != null) {
      handleShortcut(shortcutId, data);
      return;
    }

    // 2. Fallback: legacy extra-based shortcut (for compatibility)
    String legacyShortcutId = intent.getStringExtra("shortcutId");
    if (legacyShortcutId != null) {
      handleShortcut(legacyShortcutId, null);
      return;
    }

    // 3. GPX file received via ACTION_VIEW or ACTION_SEND (Open With / Share)
    if (Intent.ACTION_SEND.equals(intent.getAction()) || (data != null && isGpxFile(data, intent.getType()))) {
      handleGpxFileIntent(intent);
      return;
    }

    // 4. External App Link (https://pedalmap.es/route/* or /ruta/*)
    if (data == null) return;

    String path = data.getPath();
    if (path == null) return;

    String scheme = data.getScheme();
    String host = data.getHost();
    if (!"https".equals(scheme) || !isPedalMapHost(host)) {
      Log.d(TAG, "applink internal route ignored=" + path);
      return;
    }

    if (!isAppLinkPath(path)) {
      Log.d(TAG, "applink internal route ignored=" + path);
      return;
    }

    String query = data.getEncodedQuery();
    String target = path + (query != null && !query.isEmpty() ? "?" + query : "");

    String routeId = extractRouteId(path);
    if (routeId == null) {
      Log.d(TAG, "applink invalid route path=" + path);
      return;
    }

    if (isDuplicateIntent(target)) {
      Log.d(TAG, "applink duplicate ignored=" + target);
      return;
    }
    markIntentHandled(target);

    Log.d(TAG, "applink received external URL=" + target);
    Log.d(TAG, "applink routeId=" + routeId);
    Log.d(TAG, "applink navigating=" + target);
    dispatchDeepLink(target, "external");
  }

  private boolean isGpxFile(Uri data, String declaredMimeType) {
    if (data == null) return false;
    return GpxIntentValidator.isGpxFile(
        data.getScheme(),
        data.getPath(),
        declaredMimeType,
        resolveMimeType(data)
    );
  }

  private String resolveMimeType(Uri uri) {
    try {
      return getContentResolver().getType(uri);
    } catch (SecurityException e) {
      Log.w(TAG, "[gpx] provider denied MIME lookup for URI", e);
      return null;
    }
  }

  private void handleGpxFileIntent(Intent intent) {
    Uri uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
    if (uri == null) {
      uri = intent.getData();
    }
    if (uri == null) {
      Log.w(TAG, "handleGpxFileIntent: no uri found");
      return;
    }
    String declaredMimeType = intent.getType();
    String resolvedMimeType = resolveMimeType(uri);
    if (!GpxIntentValidator.isGpxFile(
        uri.getScheme(),
        uri.getPath(),
        declaredMimeType,
        resolvedMimeType
    )) {
      Log.w(TAG, "[gpx] rejected unsupported URI scheme, MIME type, or file extension");
      return;
    }

    String mimeType = GpxIntentValidator.isSupportedGpxMime(declaredMimeType)
        ? declaredMimeType
        : GpxIntentValidator.isSupportedGpxMime(resolvedMimeType)
            ? resolvedMimeType
            : resolvedMimeType != null ? resolvedMimeType : declaredMimeType;
    if (mimeType == null) mimeType = "application/gpx+xml";

    // Import immediately under the temporary read grant; this flow never needs
    // to retain a persistable permission after the incoming intent is handled.
    int intentFlags = intent.getFlags();
    boolean hasReadGrant = (intentFlags & Intent.FLAG_GRANT_READ_URI_PERMISSION) != 0;

    Log.d(TAG, "[gpx] action=" + intent.getAction());
    Log.d(TAG, "[gpx] uri=" + uri.toString());
    Log.d(TAG, "[gpx] type=" + mimeType);
    Log.d(TAG, "[gpx] flags=0x" + Integer.toHexString(intentFlags));
    Log.d(TAG, "[gpx] hasReadGrant=" + hasReadGrant);

    // If no read grant, we cannot read the URI safely.
    if (!hasReadGrant) {
      Log.w(TAG, "[gpx] no read URI grant; cannot read content");
      return;
    }

    String content = readGpxFileContent(uri);
    if (content == null) {
      Log.w(TAG, "handleGpxFileIntent: failed to read content");
      return;
    }

    Log.d(TAG, "[gpx] content read bytes=" + content.length());
    Log.d(TAG, "[gpx] dispatching import event");
    dispatchGpxEvent(uri, mimeType, content);
    Log.d(TAG, "[gpx] import event dispatched");
  }

  private String readGpxFileContent(Uri uri) {
    try (InputStream inputStream = getContentResolver().openInputStream(uri)) {
      if (inputStream == null) {
        Log.w(TAG, "inputStream null for uri=" + uri);
        return null;
      }

      String content = GpxContentReader.read(inputStream, MAX_GPX_FILE_BYTES);
      if (content == null) {
        Log.w(TAG, "[gpx] rejected malformed UTF-8 input or file larger than 10 MiB");
        return null;
      }

      Log.d(TAG, "[gpx] file read characters=" + content.length());
      return content;
    } catch (SecurityException e) {
      Log.e(TAG, "[gpx] SecurityException reading gpx file from uri=" + uri + " (likely no read grant): " + e.getMessage());
      return null;
    } catch (IOException e) {
      Log.e(TAG, "Error reading gpx file from uri=" + uri, e);
      return null;
    }
  }

  private void dispatchGpxEvent(Uri uri, String mimeType, String content) {
    if (content == null) content = "";
    // JSON string literals are valid JavaScript values; do not hand-escape data into JS source.
    String safeUri = org.json.JSONObject.quote(uri.toString());
    String safeType = org.json.JSONObject.quote(mimeType == null ? "" : mimeType);
    String safeContent = org.json.JSONObject.quote(content);
    String js = "window.dispatchEvent(new CustomEvent('pedalmap-gpx-import', { detail: { uri: " + safeUri + ", type: " + safeType + ", content: " + safeContent + " } }))";

    WebView webView = getBridge() != null ? getBridge().getWebView() : null;
    if (webView == null) {
      Log.w(TAG, "WebView not ready for gpx import; deferring up to 2s.");
      new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(new Runnable() {
        int retries = 0;
        @Override
        public void run() {
          WebView wv = getBridge() != null ? getBridge().getWebView() : null;
          if (wv == null && retries < 20) {
            retries++;
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(this, 100);
            return;
          }
          if (wv == null) {
            Log.e(TAG, "WebView never became ready; cannot dispatch gpx import event");
            return;
          }
          wv.evaluateJavascript(js, null);
        }
      }, 500);
      return;
    }
    webView.evaluateJavascript(js, null);
  }

  private String extractShortcutFromUri(Uri data) {
    if (data == null) return null;
    if (!"pedalmap".equals(data.getScheme())) return null;
    if (!"shortcut".equals(data.getHost())) return null;

    String path = data.getPath();
    if (path == null) return null;

    if (path.equals("/create_route")) return "create_route";
    if (path.equals("/my_routes")) return "my_routes";
    if (path.equals("/import_gpx")) return "import_gpx";
    if (path.equals("/daily_route")) return "daily_route";

    return null;
  }

  private void handleShortcut(String shortcutId, Uri uri) {
    if (uri != null) {
      Log.d(TAG, "shortcut uri=" + uri.toString());
    }

    Log.d(TAG, "shortcut id=" + shortcutId);

    String shortcutPath = mapShortcutToPath(shortcutId);
    Log.d(TAG, "shortcut target=" + shortcutPath);

    if (shortcutPath == null) {
      Log.d(TAG, "shortcut unknown id=" + shortcutId);
      return;
    }

    String shortcutKey = "shortcut:" + shortcutId;
    if (handledShortcuts.contains(shortcutKey)) {
      Log.d(TAG, "shortcut duplicate ignored=" + shortcutId);
      return;
    }

    Log.d(TAG, "shortcut dispatch attempt target=" + shortcutPath);
    boolean dispatched = dispatchDeepLink(shortcutPath, "shortcut");
    if (dispatched) {
      handledShortcuts.add(shortcutKey);
      if (handledShortcuts.size() > 50) {
        handledShortcuts.clear();
      }
      Log.d(TAG, "shortcut marked handled=" + shortcutId);
    } else {
      Log.d(TAG, "shortcut bridge not ready; pending target=" + shortcutPath);
    }
  }

  private String mapShortcutToPath(String shortcutId) {
    switch (shortcutId) {
      case "create_route":
        return "/route-planner";
      case "my_routes":
        return "/my-routes";
      case "import_gpx":
        return "/gpx-import";
      case "daily_route":
        return "/ruta";
      default:
        return null;
    }
  }

  private boolean dispatchDeepLink(String target, String source) {
    WebView webView = getBridge() != null ? getBridge().getWebView() : null;
    if (webView == null) {
      // Store as pending and retry when Bridge is ready
      pendingDeepLinkTarget = target;
      pendingDeepLinkSource = source;
      pendingRetryCount = 0;
      schedulePendingRetry();
      return false;
    }

    String safe = org.json.JSONObject.quote(target);
    String safeSource = org.json.JSONObject.quote(source);
    Log.d(TAG, "dispatchDeepLink target=" + safe + " source=" + safeSource);

    // Serialize all external strings as JavaScript string literals.
    String storeJs = "window.__PENDING_DEEPLINK__ = { url: " + safe + ", source: " + safeSource + " };";
    webView.post(() -> webView.evaluateJavascript(storeJs, null));

    String js = "window.dispatchEvent(new CustomEvent('capacitor-deep-link', { detail: { url: " + safe + ", source: " + safeSource + " } }))";
    webView.post(() -> webView.evaluateJavascript(js, null));

    // Clear any pending since we succeeded
    pendingDeepLinkTarget = null;
    pendingDeepLinkSource = null;
    return true;
  }

  private void schedulePendingRetry() {
    mainHandler.postDelayed(() -> {
      dispatchPendingDeepLink();
    }, 100);
  }

  private void dispatchPendingDeepLink() {
    if (pendingDeepLinkTarget == null) return;

    WebView webView = getBridge() != null ? getBridge().getWebView() : null;
    if (webView == null) {
      pendingRetryCount++;
      if (pendingRetryCount < MAX_PENDING_RETRIES) {
        Log.d(TAG, "shortcut dispatch retry=" + pendingRetryCount + " target=" + pendingDeepLinkTarget);
        schedulePendingRetry();
      } else {
        Log.w(TAG, "shortcut dispatch timeout; giving up target=" + pendingDeepLinkTarget);
        pendingDeepLinkTarget = null;
        pendingDeepLinkSource = null;
      }
      return;
    }

    // WebView is ready, dispatch the pending deep link
    String target = pendingDeepLinkTarget;
    String source = pendingDeepLinkSource;
    Log.d(TAG, "shortcut dispatch success target=" + target + " source=" + source);

    String safe = org.json.JSONObject.quote(target);
    String safeSource = org.json.JSONObject.quote(source);
    Log.d(TAG, "dispatchDeepLink target=" + safe + " source=" + safeSource);

    // Serialize all external strings as JavaScript string literals.
    String storeJs = "window.__PENDING_DEEPLINK__ = { url: " + safe + ", source: " + safeSource + " };";
    webView.post(() -> webView.evaluateJavascript(storeJs, null));

    String js = "window.dispatchEvent(new CustomEvent('capacitor-deep-link', { detail: { url: " + safe + ", source: " + safeSource + " } }))";
    webView.post(() -> webView.evaluateJavascript(js, null));

    // Mark shortcut as handled now that dispatch succeeded
    String shortcutKey = "shortcut:" + extractShortcutIdFromTarget(target);
    if (shortcutKey != null && !handledShortcuts.contains(shortcutKey)) {
      handledShortcuts.add(shortcutKey);
      if (handledShortcuts.size() > 50) {
        handledShortcuts.clear();
      }
      Log.d(TAG, "shortcut marked handled=" + shortcutKey);
    }

    // Clear pending
    pendingDeepLinkTarget = null;
    pendingDeepLinkSource = null;
  }

  private String extractShortcutIdFromTarget(String target) {
    if (target.equals("/route-planner")) return "create_route";
    if (target.equals("/my-routes")) return "my_routes";
    if (target.equals("/gpx-import")) return "import_gpx";
    if (target.equals("/ruta")) return "daily_route";
    return null;
  }

  private boolean isPedalMapHost(String host) {
    return "pedalmap.es".equals(host) || "www.pedalmap.es".equals(host);
  }

  private boolean isAppLinkPath(String path) {
    return path != null && (path.startsWith("/route/") || path.startsWith("/ruta/"));
  }

  private String extractRouteId(String path) {
    if (path.startsWith("/route/")) {
      return path.substring("/route/".length());
    }
    if (path.startsWith("/ruta/")) {
      return path.substring("/ruta/".length());
    }
    return null;
  }

  private boolean isDuplicateIntent(String target) {
    return handledIntents.contains(target);
  }

  private void markIntentHandled(String target) {
    handledIntents.add(target);
    if (handledIntents.size() > 50) {
      handledIntents.clear();
    }
  }

  /**
   * Standard Android back: step back through the in-app WebView history first.
   * If there is no history (e.g. landed on /fuel directly with a fresh task),
   * fall back to the home SPA location instead of finishing the task — this keeps
   * the user inside PedalMap rather than hard-exiting. Normal in-page navigation
   * (Fuel internal links, PedalMap routes) still uses native WebView back.
   */
  @Override
  public void onBackPressed() {
    if (getBridge() != null && getBridge().getWebView() != null) {
      android.webkit.WebView webView = getBridge().getWebView();
      if (webView.canGoBack()) {
        webView.goBack();
        return;
      }
      // No in-app history to pop (e.g. deep-linked straight to /fuel): navigate
      // back to the home SPA synchronously instead of finishing the task, so the
      // app stays open and Android Back lands on PedalMap Home.
      webView.loadUrl("https://localhost/");
      return;
    }
    super.onBackPressed();
  }
}