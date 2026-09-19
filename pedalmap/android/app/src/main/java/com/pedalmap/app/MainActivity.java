package com.pedalmap.app;

import android.content.Intent;
import android.net.Uri;
import android.util.Log;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

import java.util.HashSet;
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
  private final Set<String> handledIntents = new HashSet<>();

  @Override
  public void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);

    if (intent == null) return;
    if (!Intent.ACTION_VIEW.equals(intent.getAction())) return;

    Uri data = intent.getData();
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

  private void dispatchDeepLink(String target, String source) {
    WebView webView = getBridge() != null ? getBridge().getWebView() : null;
    if (webView == null) {
      Log.w(TAG, "dispatchDeepLink: webView is null");
      return;
    }
    String safe = target.replace("'", "\\'");
    Log.d(TAG, "dispatchDeepLink target=" + safe + " source=" + source);
    String js = "window.dispatchEvent(new CustomEvent('capacitor-deep-link', { detail: { url: '" + safe + "', source: '" + source + "' } }))";
    webView.post(() -> webView.evaluateJavascript(js, null));
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