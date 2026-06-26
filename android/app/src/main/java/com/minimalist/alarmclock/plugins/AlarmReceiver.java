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

        int id = intent.getIntExtra("id", -1);
        if (id == -1) {
            Log.e(TAG, "Received alarm intent with no valid id, ignoring.");
            return;
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

