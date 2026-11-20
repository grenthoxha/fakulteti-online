package io.github.grenthoxha.fakultetionline;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.drawable.Icon;
import android.os.Build;
import android.os.SystemClock;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public final class DemoNotifications extends BroadcastReceiver {
    private static final String CHANNEL = "demo_notifications";
    private static final String TICK = "io.github.grenthoxha.fakultetionline.DEMO_TICK";
    private static final String STOP = "io.github.grenthoxha.fakultetionline.DEMO_STOP";
    private static final String DUE_AT = "due_at";
    private static final int REPEAT_ID = 2;
    private static final long INTERVAL_MS = 5 * 60 * 1000L;
    private static final int ALARM_FLAGS = PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_ONE_SHOT;
    static final String OPEN_ITEM = "notification_item";
    static final String OPEN_SCOPE = "notification_scope";

    // Only the trusted app page can replace this private, short-lived snapshot.
    static void sync(Context context, String payload) {
        if (payload.length() > 40000) return;
        try {
            JSONObject incoming = new JSONObject(payload);
            String scope = incoming.getString("scope");
            long expires = incoming.getLong("expires");
            long now = System.currentTimeMillis();
            if (scope.trim().isEmpty() || scope.length() > 400 || expires <= now || expires > now + 26 * 3600000L) return;
            JSONArray source = incoming.getJSONArray("items");
            JSONArray items = new JSONArray();
            for (int i = 0; i < Math.min(source.length(), 30); i++) {
                JSONObject item = source.getJSONObject(i);
                String id = item.getString("id"), title = item.getString("title"), detail = item.getString("detail");
                if (id.trim().isEmpty() || title.trim().isEmpty() || id.length() > 400 || title.length() > 200 || detail.length() > 600) return;
                items.put(new JSONObject().put("id", id).put("title", title).put("detail", detail));
            }
            SharedPreferences prefs = preferences(context);
            String activeId = prefs.getString("active_item", "");
            boolean sameAccount = scope.equals(prefs.getString("scope", ""));
            boolean stillUnread = false;
            for (int i = 0; i < items.length(); i++) {
                if (activeId.equals(items.getJSONObject(i).getString("id"))) stillUnread = true;
            }
            if (!sameAccount || !stillUnread) {
                context.getSystemService(NotificationManager.class).cancel(1);
                context.getSystemService(NotificationManager.class).cancel(REPEAT_ID);
            }
            if (!sameAccount || items.length() == 0) stop(context);
            prefs.edit().putString("scope", scope).putString("items", items.toString())
                    .putLong("expires", expires).apply();
        } catch (JSONException invalid) {
            // Ignore malformed snapshots instead of displaying unverified fallback text.
        }
    }

    static boolean hasContent(Context context) {
        return firstItem(context) != null;
    }

    static String scope(Context context) {
        return preferences(context).getString("scope", "");
    }

    private static JSONObject firstItem(Context context) {
        SharedPreferences prefs = preferences(context);
        if (prefs.getLong("expires", 0) <= System.currentTimeMillis()) return null;
        try {
            return new JSONArray(prefs.getString("items", "[]")).optJSONObject(0);
        } catch (JSONException invalid) {
            return null;
        }
    }

    static boolean canPost(Context context) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        manager.createNotificationChannel(new NotificationChannel(
                CHANNEL, "Njoftime provë", NotificationManager.IMPORTANCE_HIGH));
        return manager.areNotificationsEnabled()
                && manager.getNotificationChannel(CHANNEL).getImportance() != NotificationManager.IMPORTANCE_NONE;
    }

    static boolean canSchedule(Context context) {
        return Build.VERSION.SDK_INT < 31 || context.getSystemService(AlarmManager.class).canScheduleExactAlarms();
    }

    static boolean isRepeating(Context context) {
        return canSchedule(context) && preferences(context).getLong(DUE_AT, 0) != 0
                && PendingIntent.getBroadcast(context, 0, command(context, TICK),
                        ALARM_FLAGS | PendingIntent.FLAG_NO_CREATE) != null;
    }

    static boolean start(Context context) {
        if (!hasContent(context) || !scheduleNext(context)) return false;
        post(context, true);
        return true;
    }

    static void stop(Context context) {
        preferences(context).edit().remove(DUE_AT).apply();
        PendingIntent alarm = PendingIntent.getBroadcast(context, 0, command(context, TICK),
                ALARM_FLAGS | PendingIntent.FLAG_NO_CREATE);
        if (alarm != null) {
            context.getSystemService(AlarmManager.class).cancel(alarm);
            alarm.cancel();
        }
        context.getSystemService(NotificationManager.class).cancel(REPEAT_ID);
    }

    static void post(Context context, boolean repeat) {
        JSONObject item = firstItem(context);
        if (item == null) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        Intent openApp = new Intent(context, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP)
                .putExtra(OPEN_ITEM, item.optString("id"))
                .putExtra(OPEN_SCOPE, scope(context));
        PendingIntent open = PendingIntent.getActivity(context, repeat ? REPEAT_ID : 1, openApp,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification.Builder notification = new Notification.Builder(context, CHANNEL)
                .setSmallIcon(R.drawable.ic_notification)
                .setLargeIcon(Icon.createWithResource(context, R.mipmap.ic_launcher))
                .setColor(0xff1859ae)
                .setContentTitle(item.optString("title"))
                .setContentText(item.optString("detail"))
                .setStyle(new Notification.BigTextStyle().bigText(item.optString("detail")))
                .setSubText(repeat ? "Provë çdo 5 min" : "Nga njoftimet e tua")
                .setCategory(Notification.CATEGORY_REMINDER)
                .setContentIntent(open)
                .setAutoCancel(true);
        if (repeat) {
            PendingIntent stop = PendingIntent.getBroadcast(
                    context, 1, command(context, STOP), PendingIntent.FLAG_IMMUTABLE);
            notification.addAction(new Notification.Action.Builder(null, "Ndale provën", stop).build());
        }
        preferences(context).edit().putString("active_item", item.optString("id")).apply();
        manager.notify(repeat ? REPEAT_ID : 1, notification.build());
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (STOP.equals(intent.getAction())) {
            stop(context);
        } else if (TICK.equals(intent.getAction())) {
            long dueAt = intent.getLongExtra(DUE_AT, 0);
            if (dueAt == 0 || dueAt != preferences(context).getLong(DUE_AT, 0)) return;
            if (hasContent(context) && canPost(context) && scheduleNext(context)) post(context, true);
            else stop(context);
        }
    }

    private static boolean scheduleNext(Context context) {
        if (!canSchedule(context)) return false;
        long dueAt = SystemClock.elapsedRealtime() + INTERVAL_MS;
        Intent tick = command(context, TICK).putExtra(DUE_AT, dueAt);
        PendingIntent alarm = PendingIntent.getBroadcast(context, 0, tick,
                ALARM_FLAGS | PendingIntent.FLAG_UPDATE_CURRENT);
        try {
            context.getSystemService(AlarmManager.class).setExactAndAllowWhileIdle(
                    AlarmManager.ELAPSED_REALTIME_WAKEUP, dueAt, alarm);
            preferences(context).edit().putLong(DUE_AT, dueAt).apply();
            return true;
        } catch (SecurityException revoked) {
            alarm.cancel();
            return false;
        }
    }

    private static Intent command(Context context, String action) {
        return new Intent(context, DemoNotifications.class).setAction(action);
    }

    private static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences(CHANNEL, Context.MODE_PRIVATE);
    }
}
