package com.pedalmap.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;
import android.widget.RemoteViews;

public class RouteWidgetProvider extends AppWidgetProvider {

    private static final String TAG = "RouteWidgetProvider";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        Log.d(TAG, "onUpdate appWidgetIds count=" + appWidgetIds.length);
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId);
        }
    }

    private void updateWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_route);

        // Click on the widget opens the app
        Intent intent = new Intent(context, MainActivity.class);
        intent.setAction(Intent.ACTION_MAIN);
        intent.putExtra("shortcutId", "create_route");
        PendingIntent pendingIntent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            pendingIntent = PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_IMMUTABLE);
        } else {
            pendingIntent = PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT);
        }
        views.setOnClickPendingIntent(R.id.widget, pendingIntent);

        // "Crear ruta" button click
        Intent buttonIntent = new Intent(context, MainActivity.class);
        buttonIntent.setAction(Intent.ACTION_MAIN);
        buttonIntent.putExtra("shortcutId", "create_route");
        PendingIntent buttonPendingIntent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            buttonPendingIntent = PendingIntent.getActivity(context, 1, buttonIntent, PendingIntent.FLAG_IMMUTABLE);
        } else {
            buttonPendingIntent = PendingIntent.getActivity(context, 1, buttonIntent, PendingIntent.FLAG_UPDATE_CURRENT);
        }
        views.setOnClickPendingIntent(R.id.widgetButton, buttonPendingIntent);

        views.setTextViewText(R.id.widgetTitle, "PedalMap");
        views.setTextViewText(R.id.widgetPrompt, "¿Qué ruta hacemos hoy?");
        views.setTextViewText(R.id.widgetButton, "Crear ruta");

        appWidgetManager.updateAppWidget(appWidgetId, views);
        Log.d(TAG, "widget updated id=" + appWidgetId);
    }
}
