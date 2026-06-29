package com.minimalist.alarmclock.plugins;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import android.graphics.Color;
import android.widget.LinearLayout;
import android.view.Gravity;
import android.graphics.drawable.GradientDrawable;
import android.widget.TextClock;

public class AlarmActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        int id = getIntent().getIntExtra("id", 0);
        String label = getIntent().getStringExtra("label");

        // Layout creation programmatically to avoid XML
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        layout.setBackgroundColor(Color.parseColor("#09090b"));
        layout.setPadding(60, 60, 60, 60);

        TextClock timeView = new TextClock(this);
        timeView.setFormat12Hour("h:mm a");
        timeView.setFormat24Hour("HH:mm");
        timeView.setTextSize(64);
        timeView.setTextColor(Color.WHITE);
        timeView.setGravity(Gravity.CENTER);
        layout.addView(timeView);

        TextView labelView = new TextView(this);
        labelView.setText(label != null ? label : "Будильник");
        labelView.setTextSize(24);
        labelView.setTextColor(Color.parseColor("#A1A1AA")); // zinc-400
        labelView.setGravity(Gravity.CENTER);
        labelView.setPadding(0, 20, 0, 100);
        layout.addView(labelView);

        // Buttons Layout
        LinearLayout buttonsLayout = new LinearLayout(this);
        buttonsLayout.setOrientation(LinearLayout.HORIZONTAL);
        buttonsLayout.setGravity(Gravity.CENTER);

        // Snooze Button
        Button snoozeBtn = new Button(this);
        snoozeBtn.setText("ОТЛОЖИТЬ");
        snoozeBtn.setTextColor(Color.WHITE);
        GradientDrawable snoozeBg = new GradientDrawable();
        snoozeBg.setColor(Color.parseColor("#27272a")); // zinc-800
        snoozeBg.setCornerRadius(30f);
        snoozeBtn.setBackground(snoozeBg);
        snoozeBtn.setPadding(40, 40, 40, 40);
        LinearLayout.LayoutParams snoozeParams = new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f);
        snoozeParams.setMargins(0, 0, 20, 0);
        snoozeBtn.setLayoutParams(snoozeParams);
        
        // Dismiss Button
        Button dismissBtn = new Button(this);
        dismissBtn.setText("ВЫКЛЮЧИТЬ");
        dismissBtn.setTextColor(Color.BLACK);
        GradientDrawable dismissBg = new GradientDrawable();
        dismissBg.setColor(Color.WHITE);
        dismissBg.setCornerRadius(30f);
        dismissBtn.setBackground(dismissBg);
        dismissBtn.setPadding(40, 40, 40, 40);
        LinearLayout.LayoutParams dismissParams = new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f);
        dismissParams.setMargins(20, 0, 0, 0);
        dismissBtn.setLayoutParams(dismissParams);

        buttonsLayout.addView(snoozeBtn);
        buttonsLayout.addView(dismissBtn);
        layout.addView(buttonsLayout);

        setContentView(layout);

        snoozeBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                stopAlarm();
                Intent i = new Intent("com.minimalist.alarmclock.ALARM_ACTION");
                i.putExtra("id", id);
                i.putExtra("action", "snooze");
                sendBroadcast(i);
                
                Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
                if (launchIntent != null) {
                    launchIntent.putExtra("alarm_action", "snooze");
                    launchIntent.putExtra("alarm_id", id);
                    launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    startActivity(launchIntent);
                }
                finish();
            }
        });

        dismissBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                stopAlarm();
                Intent i = new Intent("com.minimalist.alarmclock.ALARM_ACTION");
                i.putExtra("id", id);
                i.putExtra("action", "dismiss");
                sendBroadcast(i);
                
                Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
                if (launchIntent != null) {
                    launchIntent.putExtra("alarm_action", "dismiss");
                    launchIntent.putExtra("alarm_id", id);
                    launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    startActivity(launchIntent);
                }
                finish();
            }
        });
    }

    private void stopAlarm() {
        Intent stopIntent = new Intent(this, AlarmService.class);
        stopIntent.setAction("STOP_ALARM");
        try {
            startService(stopIntent);
        } catch (Exception e) {
            android.util.Log.e("AlarmActivity", "Failed to start stop service", e);
        }

        int id = getIntent().getIntExtra("id", 0);
        android.app.NotificationManager nm = (android.app.NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.cancel(id);
        }
    }

    @Override
    public void onBackPressed() {
        stopAlarm();
        int id = getIntent().getIntExtra("id", 0);
        Intent i = new Intent("com.minimalist.alarmclock.ALARM_ACTION");
        i.putExtra("id", id);
        i.putExtra("action", "snooze");
        sendBroadcast(i);
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
    }
}
