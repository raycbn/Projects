package com.pedalmap.app.plugins;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Log;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;

@CapacitorPlugin(name = "DocumentPicker")
public class DocumentPickerPlugin extends Plugin {
    private static final String TAG = "DocumentPickerPlugin";

    @PluginMethod
    public void pickFile(PluginCall call) {
        String mimeType = call.getString("mimeType", "application/gpx+xml,text/xml,application/xml");
        String fileName = call.getString("fileName");
        Log.d(TAG, "pickFile mimeType=" + mimeType + " fileName=" + fileName);

        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mimeType);

        startActivityForResult(call, intent, "handleActivityResult");
    }

    @PluginMethod
    public void pickGpxFile(PluginCall call) {
        Log.d(TAG, "pickGpxFile");
        // Convenience method specifically for GPX with proper mime types
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/gpx+xml");
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/gpx+xml", "text/xml", "application/xml"});

        startActivityForResult(call, intent, "handleActivityResult");
    }

    @ActivityCallback
    private void handleActivityResult(PluginCall call, ActivityResult result) {
        Log.d(TAG, "handleActivityResult resultCode=" + result.getResultCode());
        if (result.getResultCode() != Activity.RESULT_OK) {
            Log.d(TAG, "handleActivityResult: canceled or no result");
            if (call != null) {
                call.reject("User canceled");
            }
            return;
        }

        Intent data = result.getData();
        if (data == null) {
            Log.w(TAG, "handleActivityResult: data is null");
            if (call != null) {
                call.reject("No data returned");
            }
            return;
        }

        Uri uri = data.getData();
        if (uri == null) {
            Log.w(TAG, "handleActivityResult: uri is null");
            if (call != null) {
                call.reject("No uri returned");
            }
            return;
        }

        Log.d(TAG, "handleActivityResult uri=" + uri.toString());

        String content = readFileContent(uri);
        if (content == null) {
            Log.w(TAG, "handleActivityResult: content is null");
            if (call != null) {
                call.reject("Failed to read file content");
            }
            return;
        }

        String fileName = getFileNameFromUri(uri);
        Log.d(TAG, "handleActivityResult fileName=" + fileName + " content length=" + content.length());

        if (call != null) {
            JSObject resultObj = new JSObject();
            resultObj.put("uri", uri.toString());
            resultObj.put("content", content);
            resultObj.put("name", fileName);
            resultObj.put("mimeType", getContext().getContentResolver().getType(uri));
            call.resolve(resultObj);
        }
    }

    private String getFileNameFromUri(Uri uri) {
        String fileName = "route.gpx";
        try (android.database.Cursor cursor = getContext().getContentResolver().query(uri, null, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int nameIndex = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME);
                if (nameIndex >= 0) {
                    String name = cursor.getString(nameIndex);
                    if (name != null && !name.isEmpty()) {
                        fileName = name;
                    }
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "getFileNameFromUri: failed to query display name", e);
        }
        return fileName;
    }

    private String readFileContent(Uri uri) {
        try {
            InputStream inputStream = getActivity().getContentResolver().openInputStream(uri);
            if (inputStream == null) {
                Log.w(TAG, "inputStream null for uri=" + uri);
                return null;
            }

            BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream));
            StringBuilder sb = new StringBuilder();
            char[] buffer = new char[8192];
            int len;
            int total = 0;
            while ((len = reader.read(buffer)) > 0) {
                total += len;
                if (total > 10 * 1024 * 1024) {
                    Log.w(TAG, "file too large, truncating at 10MB");
                    break;
                }
                sb.append(buffer, 0, len);
            }
            reader.close();
            inputStream.close();
            Log.d(TAG, "readContent bytesRead=" + sb.length());
            return sb.toString();
        } catch (IOException e) {
            Log.e(TAG, "Error reading file from uri=" + uri, e);
            return null;
        }
    }
}
