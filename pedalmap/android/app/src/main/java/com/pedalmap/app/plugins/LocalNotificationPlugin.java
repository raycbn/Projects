package com.pedalmap.app.plugins;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "LocalNotification",
    permissions = {
        @Permission(strings = {android.Manifest.permission.POST_NOTIFICATIONS}, alias = "notifications")
    }
)
public class LocalNotificationPlugin extends Plugin {
    private static final String TAG = "LocalNotificationPlugin";
    private static final String CHANNEL_ID = "pedalmap_files";
    private static final String CHANNEL_NAME = "PedalMap — Archivos";
    private static final String CHANNEL_DESC = "Notificaciones de archivos guardados (GPX, rutas)";
    private static final String CHANNEL_ID_ROUTES = "pedalmap_routes";
    private static final String CHANNEL_NAME_ROUTES = "PedalMap — Rutas";
    private static final String CHANNEL_DESC_ROUTES = "Notificaciones de rutas preparadas y actividad";

    private NotificationManager notificationManager;

    @Override
    public void load() {
        notificationManager = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        createChannelIfNeeded();
    }

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        String status = checkNotificationSelfPermission();
        Log.d(TAG, "checkPermissions status=" + status);
        JSObject result = new JSObject();
        result.put("receive", status);
        call.resolve(result);
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        Log.d(TAG, "requestPermissions invoked");
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            Log.d(TAG, "requestPermissions: SDK < TIRAMISU, auto-granted");
            JSObject result = new JSObject();
            result.put("receive", "granted");
            call.resolve(result);
            return;
        }

        String currentStatus = checkNotificationSelfPermission();
        Log.d(TAG, "requestPermissions: current status=" + currentStatus);
        if (currentStatus.equals("granted")) {
            Log.d(TAG, "requestPermissions: already granted");
            JSObject result = new JSObject();
            result.put("receive", "granted");
            call.resolve(result);
            return;
        }

        Log.d(TAG, "requestPermissions: launching via requestPermissionForAlias");
        requestPermissionForAlias("notifications", call, "handleNotificationPermissionResult");
    }

    @PermissionCallback
    private void handleNotificationPermissionResult(PluginCall call) {
        String status = checkNotificationSelfPermission();
        Log.d(TAG, "handleNotificationPermissionResult: result=" + status);
        JSObject result = new JSObject();
        result.put("receive", status);
        call.resolve(result);
    }

    private String checkNotificationSelfPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(getActivity(), android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                return "denied";
            }
        }
        return "granted";
    }

    @PluginMethod
    public void showSavedGpxNotification(PluginCall call) {
        String title = call.getString("title", "GPX guardado");
        String fileName = call.getString("fileName", "ruta.gpx");
        String bodyText = call.getString("bodyText", "Guardado en Documentos");
        String uriString = call.getString("uri");

        Log.d(TAG, "showSavedGpxNotification fileName=" + fileName + " uri=" + uriString);

        if (uriString == null) {
            call.reject("Missing uri");
            return;
        }

        createChannelIfNeeded();

        Uri fileUri = resolveFileUri(uriString);

        Intent openIntent = new Intent(Intent.ACTION_VIEW);
        openIntent.setFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        openIntent.setDataAndType(fileUri, "application/gpx+xml");

        PendingIntent openPendingIntent = PendingIntent.getActivity(
            getActivity(),
            1001,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent shareIntent = new Intent(Intent.ACTION_SEND);
        shareIntent.setType("application/gpx+xml");
        shareIntent.putExtra(Intent.EXTRA_STREAM, fileUri);
        shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        PendingIntent sharePendingIntent = PendingIntent.getActivity(
            getActivity(),
            1002,
            Intent.createChooser(shareIntent, "Compartir GPX"),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        int smallIcon = getSmallIcon();

        NotificationCompat.Builder builder = new NotificationCompat.Builder(getActivity(), CHANNEL_ID)
            .setSmallIcon(smallIcon)
            .setContentTitle(title)
            .setStyle(new NotificationCompat.BigTextStyle()
                .bigText(fileName + "\n\n" + bodyText)
                .setBigContentTitle(title)
            )
            .setSubText("Guardado en Documentos")
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .setContentIntent(openPendingIntent)
            .addAction(0, "Abrir", openPendingIntent)
            .addAction(0, "Compartir", sharePendingIntent);

        int notificationId = 10001;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(getActivity(), android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                Log.w(TAG, "POST_NOTIFICATIONS not granted; notification suppressed");
                JSObject result = new JSObject();
                result.put("shown", false);
                result.put("notificationId", notificationId);
                call.resolve(result);
                return;
            }
        }

        NotificationManagerCompat.from(getActivity()).notify(notificationId, builder.build());
        Log.d(TAG, "notification shown id=" + notificationId + " fileName=" + fileName);

        JSObject result = new JSObject();
        result.put("shown", true);
        result.put("notificationId", notificationId);
        call.resolve(result);
    }

    private Uri resolveFileUri(String uriString) {
        Uri uri = Uri.parse(uriString);
        String scheme = uri.getScheme();

        if ("content".equals(scheme)) {
            return uri;
        }

        if ("file".equals(scheme)) {
            Log.d(TAG, "resolveFileUri: file:// URI detected, attempting FileProvider conversion: " + uriString);
            String authority = getActivity().getPackageName() + ".fileprovider";
            try {
                java.io.File file = new java.io.File(uri.getPath());
                if (file.exists()) {
                    Uri contentUri = androidx.core.content.FileProvider.getUriForFile(
                        getActivity(),
                        authority,
                        file
                    );
                    Log.d(TAG, "resolveFileUri: converted to content:// " + contentUri);
                    return contentUri;
                } else {
                    Log.w(TAG, "resolveFileUri: file does not exist: " + uri.getPath());
                }
            } catch (Exception e) {
                Log.w(TAG, "resolveFileUri: FileProvider conversion failed, using original file:// URI", e);
            }
            return uri;
        }

        Log.w(TAG, "resolveFileUri: unknown scheme, using as-is: " + uriString);
        return uri;
    }

    private void createChannelIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && notificationManager != null) {
            // Files channel (GPX)
            if (notificationManager.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_DEFAULT
                );
                channel.setDescription(CHANNEL_DESC);
                channel.enableLights(false);
                channel.enableVibration(false);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    channel.setSound(null, null);
                }
                notificationManager.createNotificationChannel(channel);
                Log.d(TAG, "channel created: " + CHANNEL_ID);
            }
            // Routes channel (route ready)
            if (notificationManager.getNotificationChannel(CHANNEL_ID_ROUTES) == null) {
                NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID_ROUTES,
                    CHANNEL_NAME_ROUTES,
                    NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription(CHANNEL_DESC_ROUTES);
                channel.enableLights(true);
                channel.enableVibration(true);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    channel.setSound(null, null);
                }
                notificationManager.createNotificationChannel(channel);
                Log.d(TAG, "channel created: " + CHANNEL_ID_ROUTES);
            }
        }
    }

    @PluginMethod
    public void showRouteReadyNotification(PluginCall call) {
        String title = call.getString("title", "Ruta preparada");
        String bodyText = call.getString("bodyText", "Tu ruta ya está lista.");
        String routeSlug = call.getString("routeSlug");

        Log.d(TAG, "showRouteReadyNotification title=" + title + " routeSlug=" + routeSlug);

        createChannelIfNeeded();

        // Build intent to open the route
        Intent openIntent = new Intent(Intent.ACTION_VIEW);
        openIntent.setFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        if (routeSlug != null && !routeSlug.isEmpty()) {
            // Use custom scheme for the route
            openIntent.setData(Uri.parse("pedalmap://shortcut/daily_route?route=" + routeSlug));
        } else {
            // Fallback to main activity
            openIntent.setClassName(getActivity().getPackageName(), getActivity().getPackageName() + ".MainActivity");
        }

        PendingIntent openPendingIntent = PendingIntent.getActivity(
            getActivity(),
            2001,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        int smallIcon = getSmallIcon();

        NotificationCompat.Builder builder = new NotificationCompat.Builder(getActivity(), CHANNEL_ID_ROUTES)
            .setSmallIcon(smallIcon)
            .setContentTitle(title)
            .setStyle(new NotificationCompat.BigTextStyle()
                .bigText(bodyText)
                .setBigContentTitle(title)
            )
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(openPendingIntent)
            .addAction(0, "Abrir ruta", openPendingIntent);

        int notificationId = 20001;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(getActivity(), android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                Log.w(TAG, "POST_NOTIFICATIONS not granted; route ready notification suppressed");
                JSObject result = new JSObject();
                result.put("shown", false);
                result.put("notificationId", notificationId);
                call.resolve(result);
                return;
            }
        }

        NotificationManagerCompat.from(getActivity()).notify(notificationId, builder.build());
        Log.d(TAG, "route ready notification shown id=" + notificationId + " routeSlug=" + routeSlug);

        JSObject result = new JSObject();
        result.put("shown", true);
        result.put("notificationId", notificationId);
        call.resolve(result);
    }

    private int getSmallIcon() {
        int icon = getActivity().getApplicationInfo().icon;
        return icon != 0 ? icon : android.R.drawable.ic_menu_save;
    }
}
