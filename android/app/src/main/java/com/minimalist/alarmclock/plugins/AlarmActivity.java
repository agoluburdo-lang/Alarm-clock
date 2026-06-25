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
    private Ringtone ringtone;
    private Vibrator vibrator;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager keyguardManager = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (keyguardManager != null) {
                keyguardManager.requestDismissKeyguard(this, null);
            }
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                    | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

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
                // We should pass "snooze" intent to Capacitor App or handle it via a broadcast
                Intent i = new Intent("com.minimalist.alarmclock.ALARM_ACTION");
                i.putExtra("id", id);
                i.putExtra("action", "snooze");
                sendBroadcast(i);
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
                finish();
            }
        });

        playAlarm();
    }

    private void playAlarm() {
        Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (alarmUri == null) {
            alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        }
        ringtone = RingtoneManager.getRingtone(getApplicationContext(), alarmUri);
        if (ringtone != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                ringtone.setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build());
            }
            ringtone.play();
        }

        vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        if (vibrator != null && vibrator.hasVibrator()) {
            long[] pattern = {0, 1000, 1000};
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
            } else {
                vibrator.vibrate(pattern, 0);
            }
        }
    }

    private void stopAlarm() {
        if (ringtone != null && ringtone.isPlaying()) {
            ringtone.stop();
        }
        if (vibrator != null) {
            vibrator.cancel();
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
        stopAlarm();
    }
}
