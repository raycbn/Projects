package com.pedalmap.app.plugins;

import android.app.Activity;
import android.content.ClipData;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.util.Log;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;

/**
 * Native route sharing for Android.
 * Uses Android Sharesheet (Intent.ACTION_SEND with Intent.CHOOSER)
 * and Instagram Story sharing via com.instagram.share.ADD_TO_STORY.
 */
@CapacitorPlugin(name = "RouteShare")
public class RouteSharePlugin extends Plugin {
    private static final String TAG = "RouteSharePlugin";

    @PluginMethod
    public void share(PluginCall call) {
        String title = call.getString("title", "");
        String text = call.getString("text", "");
        String url = canonicalPublicUrl(call.getString("url", ""));
        String imageUriString = call.getString("imageUri");

        Log.d(TAG, "[share] native ACTION_SEND");
        Log.d(TAG, "[share] final url=" + url);
        Log.d(TAG, "[share] title=" + title);
        Log.d(TAG, "[share] textEncoding=UTF-8");

        Intent sendIntent = new Intent(Intent.ACTION_SEND);
        sendIntent.putExtra(Intent.EXTRA_TITLE, title);

        StringBuilder shareText = new StringBuilder();
        if (text != null && !text.isEmpty()) shareText.append(text);
        if (url != null && !url.isEmpty()) {
            if (shareText.length() > 0) shareText.append("\n\n");
            shareText.append(url);
        }
        sendIntent.putExtra(Intent.EXTRA_TEXT, shareText.toString());

        Uri imageUri = null;
        if (imageUriString != null && !imageUriString.isEmpty()) {
            imageUri = resolveImageUri(imageUriString);
        }
        Log.d(TAG, "[share] imageUri=" + (imageUri != null ? imageUri.toString() : "none"));

        if (imageUri != null) {
            sendIntent.setType("image/png");
            sendIntent.putExtra(Intent.EXTRA_STREAM, imageUri);
            sendIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } else {
            sendIntent.setType("text/plain");
        }

        String chooserTitle = title.isEmpty() ? "Compartir ruta" : title;
        Intent chooser = buildFilteredChooser(sendIntent, chooserTitle);
        chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        Log.d(TAG, "[share] launch=createChooserFiltered");
        startActivityForResult(call, chooser, "handleShareResult");
    }

    @PluginMethod
    public void shareToInstagramStory(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity unavailable");
            return;
        }

        String title = call.getString("title", "");
        String text = call.getString("text", "");
        String url = canonicalPublicUrl(call.getString("url", ""));
        String imageUriString = call.getString("imageUri");

        boolean instagramInstalled = isAppInstalled(activity, "com.instagram.android");
        Log.d(TAG, "[share] Instagram package=com.instagram.android");
        Log.d(TAG, "[share] Instagram installed=" + instagramInstalled);

        if (!instagramInstalled) {
            Log.d(TAG, "[share] Instagram not installed; fallback=sharesheet");
            share(call);
            return;
        }

        if (imageUriString == null) {
            Log.d(TAG, "[share] Instagram story image=missing fallback=standard_share");
            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType("text/plain");
            StringBuilder sb = new StringBuilder();
            if (text != null && !text.isEmpty()) sb.append(text);
            if (url != null && !url.isEmpty()) sb.append("\n\n").append(url);
            intent.putExtra(Intent.EXTRA_TEXT, sb.toString());
            intent.setPackage("com.instagram.android");
            try {
                startActivityForResult(call, intent, "handleInstagramShareResult");
            } catch (Exception e) {
                Log.w(TAG, "[share] Instagram standard share failed; fallback=sharesheet", e);
                intent.setPackage(null);
                Intent chooser = Intent.createChooser(intent, "Compartir");
                startActivityForResult(call, chooser, "handleShareResult");
            }
            return;
        }

        Uri stickerUri = resolveImageUri(imageUriString);
        if (stickerUri == null) {
            Log.w(TAG, "[share] Instagram story image=unresolvable fallback=sharesheet");
            share(call);
            return;
        }

        Intent storyIntent = new Intent("com.instagram.share.ADD_TO_STORY");
        storyIntent.setPackage("com.instagram.android");
        storyIntent.setDataAndType(stickerUri, "image/*");
        storyIntent.putExtra("interactive_asset_uri", stickerUri);
        storyIntent.putExtra("content_url", url != null ? url : "");
        storyIntent.setClipData(ClipData.newUri(activity.getContentResolver(), "PedalMap route", stickerUri));
        storyIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

        boolean canHandle = storyIntent.resolveActivity(activity.getPackageManager()) != null;
        Log.d(TAG, "[share] Instagram story resolvable=" + canHandle);
        if (!canHandle) {
            Log.w(TAG, "[share] Instagram story intent=unresolvable fallback=sharesheet");
            Intent fallback = new Intent(Intent.ACTION_SEND);
            fallback.setType("image/png");
            fallback.putExtra(Intent.EXTRA_STREAM, stickerUri);
            fallback.setClipData(ClipData.newUri(activity.getContentResolver(), "PedalMap route", stickerUri));
            StringBuilder sb = new StringBuilder();
            if (text != null && !text.isEmpty()) sb.append(text);
            if (url != null && !url.isEmpty()) sb.append("\n\n").append(url);
            fallback.putExtra(Intent.EXTRA_TEXT, sb.toString());
            fallback.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent chooser = Intent.createChooser(fallback, "Compartir");
            startActivityForResult(call, chooser, "handleShareResult");
            return;
        }

        activity.startActivity(storyIntent);
        JSObject result = new JSObject();
        result.put("status", "story_intent_sent");
        result.put("instagramInstalled", true);
        call.resolve(result);
    }

    @ActivityCallback
    private void handleShareResult(PluginCall call, ActivityResult result) {
        Log.d(TAG, "handleShareResult resultCode=" + result.getResultCode());
        JSObject res = new JSObject();
        res.put("status", "completed");
        if (call != null) call.resolve(res);
    }

    @ActivityCallback
    private void handleInstagramShareResult(PluginCall call, ActivityResult result) {
        Log.d(TAG, "handleInstagramShareResult resultCode=" + result.getResultCode());
        JSObject res = new JSObject();
        res.put("status", "completed");
        res.put("instagram", "direct_share");
        if (call != null) call.resolve(res);
    }

    private Intent buildFilteredChooser(Intent sendIntent, String chooserTitle) {
        Intent chooser = Intent.createChooser(sendIntent, chooserTitle);
        Activity activity = getActivity();
        if (activity == null) {
            return chooser;
        }

        ArrayList<ComponentName> excludedComponents = new ArrayList<>();
        for (ResolveInfo resolveInfo : activity.getPackageManager().queryIntentActivities(sendIntent, 0)) {
            if (resolveInfo == null || resolveInfo.activityInfo == null) {
                continue;
            }
            String packageName = resolveInfo.activityInfo.packageName;
            if (packageName != null && isBrowserSharePackage(packageName)) {
                excludedComponents.add(new ComponentName(packageName, resolveInfo.activityInfo.name));
            }
        }

        if (!excludedComponents.isEmpty()) {
            chooser.putExtra(Intent.EXTRA_EXCLUDE_COMPONENTS, excludedComponents.toArray(new ComponentName[0]));
            Log.d(TAG, "[share] excludedBrowserComponents=" + excludedComponents.size());
        }
        return chooser;
    }

    private boolean isBrowserSharePackage(String packageName) {
        String normalized = packageName.toLowerCase();
        return normalized.equals("com.android.chrome")
                || normalized.startsWith("com.chrome.")
                || normalized.equals("org.chromium.chrome")
                || normalized.startsWith("org.chromium.chrome.")
                || normalized.startsWith("com.brave.browser");
    }

    private boolean isAppInstalled(Activity activity, String packageName) {
        try {
            activity.getPackageManager().getPackageInfo(packageName, 0);
            Log.d(TAG, "isAppInstalled pkg=" + packageName + " installed=true");
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            Log.d(TAG, "isAppInstalled pkg=" + packageName + " installed=false");
            return false;
        }
    }

    private String canonicalPublicUrl(String input) {
        if (input == null || input.isEmpty()) return input;
        try {
            Uri uri = Uri.parse(input);
            String path = uri.getPath();
            if (path == null) return input;
            String normalizedPath = path.startsWith("/ruta/") ? "/route/" + path.substring("/ruta/".length()) : path;
            if (!normalizedPath.startsWith("/route/")) return input;
            String slug = normalizedPath.substring("/route/".length());
            if (slug.isEmpty()) return input;
            return "https://pedalmap.es/route/" + slug;
        } catch (Exception e) {
            return input;
        }
    }

    private Uri resolveImageUri(String uriString) {
        Uri uri = Uri.parse(uriString);
        String scheme = uri.getScheme();

        if ("content".equals(scheme)) {
            return uri;
        }
        if ("file".equals(scheme)) {
            try {
                java.io.File file = new java.io.File(uri.getPath());
                if (file.exists()) {
                    Uri contentUri = androidx.core.content.FileProvider.getUriForFile(
                        getActivity(),
                        getActivity().getPackageName() + ".fileprovider",
                        file
                    );
                    Log.d(TAG, "resolveImageUri: converted to content:// " + contentUri);
                    return contentUri;
                }
            } catch (Exception e) {
                Log.w(TAG, "resolveImageUri: FileProvider conversion failed", e);
            }
            return uri;
        }
        return uri;
    }
}
