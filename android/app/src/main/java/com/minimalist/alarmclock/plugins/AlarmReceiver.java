package com.minimalist.alarmclock.plugins;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;
import androidx.core.content.ContextCompat;

public class AlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "AlarmReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;

        String action = intent.getAction();
        Log.d(TAG, "onReceive action: " + action);

        // Prevent BOOT_COMPLETED from ringing a false alarm with id = 0!
        if (Intent.ACTION_BOOT_COMPLETED.equals(action)) {
            Log.d(TAG, "Boot completed received. Avoiding triggering immediate alarm.");
            return;
        }

        int id = -1;
        if (intent.hasExtra("id")) {
            Object idObj = intent.getExtras().get("id");
            if (idObj instanceof Number) {
                id = ((Number) idObj).intValue();
            } else if (idObj instanceof String) {
                try {
                    id = Integer.parseInt((String) idObj);
                } catch (Exception e) {}
            }
        }

        // Fallback: Parse ID from action string
        if (id == -1 && action != null && action.startsWith("com.minimalist.alarmclock.ALARM_TRIGGER_")) {
            try {
                id = Integer.parseInt(action.substring("com.minimalist.alarmclock.ALARM_TRIGGER_".length()));
                Log.d(TAG, "Parsed alarm id from action string: " + id);
            } catch (Exception e) {
                Log.e(TAG, "Failed to parse alarm id from action string", e);
            }
        }

        if (id == -1 || id == 0) {
            // startForeground requires non-zero ID, let's make sure it's not 0 or -1
            id = 99999;
        }

        String label = intent.getStringExtra("label");
        Log.d(TAG, "Alarm received: " + id + " - " + label + ". Starting AlarmService...");

        Intent serviceIntent = new Intent(context, AlarmService.class);
        serviceIntent.putExtra("id", id);
        serviceIntent.putExtra("label", label);
        serviceIntent.setAction("START_ALARM");

        try {
            ContextCompat.startForegroundService(context, serviceIntent);
        } catch (Exception e) {
            Log.e(TAG, "Failed to start foreground AlarmService", e);
        }
    }
}

