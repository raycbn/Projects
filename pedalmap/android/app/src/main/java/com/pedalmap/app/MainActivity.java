package com.pedalmap.app;

import android.content.Intent;
import android.net.Uri;
import android.util.Log;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

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
    String query = data.getEncodedQuery();
    String target = path + (query != null && !query.isEmpty() ? "?" + query : "");

    // Skip anything we don't own (e.g. /route/:slug, /blog/:slug) so host
    // routes not handled by the embedded SPA stay as-is.
    Log.d(TAG, "Deep link received: " + target);

    WebView webView = getBridge() != null ? getBridge().getWebView() : null;
    if (webView == null) {
      Log.w(TAG, "WebView not ready; deferring.");
      return;
    }

    // Android deep-link -> SPA navigation. Build an ABSOLUTE url from the current
    // WebView origin (https://localhost in production, http://10.0.2.2:5173 on the
    // Vite dev server) so the same APK works for both and the navigation stays
    // in-app. This lets React Router (BrowserRouter) match the route and mount the
    // lazy chunk, pushing a real WebView history entry so Android Back can return.
    String safe = target.replace("'", "\\'").replace("\"", "\\\"");
    String base = webView.getUrl();
    String origin = base == null ? "https://localhost" : base;
    int slash = origin.indexOf('/', origin.indexOf("//") + 2);
    if (slash > 0) origin = origin.substring(0, slash);
    String js = "window.location.href='" + origin + safe + "';";
    webView.evaluateJavascript(js, null);
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
