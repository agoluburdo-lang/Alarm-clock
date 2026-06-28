package com.minimalist.alarmclock.plugins;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;
import androidx.core.app.NotificationCompat;

public class AlarmService extends Service {
    private static final String TAG = "AlarmService";
    private MediaPlayer mediaPlayer;
    private Vibrator vibrator;
    private PowerManager.WakeLock wakeLock;
    private android.media.Ringtone fallbackRingtone;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "AlarmService created");
        
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            try {
                // Use FULL_WAKE_LOCK with ACQUIRE_CAUSES_WAKEUP to wake the screen immediately on alarm trigger
                wakeLock = pm.newWakeLock(PowerManager.FULL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE, "MinimalistAlarm:ScreenWakeLock");
                wakeLock.acquire(10 * 60 * 1000L); // 10 minutes maximum
            } catch (Exception e) {
                Log.e(TAG, "Failed to acquire screen wake lock, trying partial wake lock", e);
                try {
                    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MinimalistAlarm:WakeLock");
                    wakeLock.acquire(10 * 60 * 1000L);
                } catch (Exception ex) {
                    Log.e(TAG, "Failed to acquire partial wake lock", ex);
                }
            }
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        String action = intent.getAction();
        Log.d(TAG, "onStartCommand action: " + action);

        if ("STOP_ALARM".equals(action)) {
            stopAlarm();
            stopSelf();
            return START_NOT_STICKY;
        }

        int id = intent.getIntExtra("id", 0);
        String label = intent.getStringExtra("label");

        // 1. Build notification & start foreground IMMEDIATELY to satisfy system requirement
        showForegroundNotification(id, label);

        // 2. Start playing sound & vibrating AFTER the service is safely in the foreground
        playAlarmSoundAndVibration();

        // 3. Launch the AlarmActivity directly to wake up the screen and show UI
        Intent activityIntent = new Intent(this, AlarmActivity.class);
        activityIntent.putExtra("id", id);
        activityIntent.putExtra("label", label);
        activityIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        try {
            startActivity(activityIntent);
            Log.d(TAG, "Successfully started AlarmActivity directly from service");
        } catch (Exception e) {
            Log.e(TAG, "Failed to start AlarmActivity directly from service, falling back to notification only", e);
        }

        return START_STICKY;
    }

    private void showForegroundNotification(int id, String label) {
        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        String channelId = "alarm_high_priority_v1";

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(channelId, "Срабатывание будильника", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Уведомления во время звонка");
            channel.setBypassDnd(true);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }

        Intent activityIntent = new Intent(this, AlarmActivity.class);
        activityIntent.putExtra("id", id);
        activityIntent.putExtra("label", label);
        activityIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);

        int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingFlags |= PendingIntent.FLAG_MUTABLE;
        }
        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(this, id, activityIntent, pendingFlags);

        int iconResId = getApplicationInfo().icon;
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
                .setSmallIcon(iconResId != 0 ? iconResId : android.R.drawable.ic_dialog_info)
                .setContentTitle(label != null ? label : "Будильник")
                .setContentText("Пора просыпаться!")
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setFullScreenIntent(fullScreenPendingIntent, true)
                .setContentIntent(fullScreenPendingIntent)
                .setOngoing(true)
                .setAutoCancel(false);

        Notification notification = builder.build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(id, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(id, notification);
        }
    }

    private void playAlarmSoundAndVibration() {
        // Stop any current playback first
        stopAudioAndVibration();

        // Request Audio Focus to prevent other apps from silencing the alarm
        AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        if (audioManager != null) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    AudioAttributes attributes = new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build();
                    android.media.AudioFocusRequest focusRequest = new android.media.AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                            .setAudioAttributes(attributes)
                            .build();
                    audioManager.requestAudioFocus(focusRequest);
                } else {
                    audioManager.requestAudioFocus(null, AudioManager.STREAM_ALARM, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK);
                }
            } catch (Exception e) {
                Log.e(TAG, "Failed to request audio focus", e);
            }
        }

        // Play Sound
        Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (alarmUri == null) {
            alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        }
        if (alarmUri == null) {
            alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        }
        
        try {
            mediaPlayer = new MediaPlayer();
            mediaPlayer.setDataSource(this, alarmUri);
            mediaPlayer.setAudioStreamType(AudioManager.STREAM_ALARM);
            
            // Critical: Set wake mode so the CPU doesn't sleep while playing the alarm
            try {
                mediaPlayer.setWakeMode(getApplicationContext(), PowerManager.PARTIAL_WAKE_LOCK);
            } catch (Exception e) {
                Log.e(TAG, "Failed to set wake mode on MediaPlayer", e);
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                mediaPlayer.setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build());
            }

            mediaPlayer.prepare();
            // Critical: setLooping must be called AFTER prepare() on many Android devices to work correctly
            mediaPlayer.setLooping(true);
            mediaPlayer.start();
            Log.d(TAG, "MediaPlayer started successfully with looping=true");
        } catch (Exception e) {
            Log.e(TAG, "Error playing alarm sound with MediaPlayer, trying fallback", e);
            playFallbackRingtone(alarmUri);
        }

        // Play Vibration
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

    private void playFallbackRingtone(Uri uri) {
        try {
            fallbackRingtone = RingtoneManager.getRingtone(getApplicationContext(), uri);
            if (fallbackRingtone != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    fallbackRingtone.setAudioAttributes(new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build());
                    // Critical: Ensure the fallback ringtone also loops forever
                    fallbackRingtone.setLooping(true);
                }
                fallbackRingtone.play();
                Log.d(TAG, "Fallback ringtone started successfully (looping=" + (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) + ")");
            }
        } catch (Exception e) {
            Log.e(TAG, "Fallback ringtone failed", e);
        }
    }

    private void stopAudioAndVibration() {
        if (mediaPlayer != null) {
            try {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.stop();
                }
            } catch (Exception e) {}
            try {
                mediaPlayer.release();
            } catch (Exception e) {}
            mediaPlayer = null;
        }
        if (fallbackRingtone != null) {
            try {
                if (fallbackRingtone.isPlaying()) {
                    fallbackRingtone.stop();
                }
            } catch (Exception e) {}
            fallbackRingtone = null;
        }
        if (vibrator != null) {
            try {
                vibrator.cancel();
            } catch (Exception e) {}
        }
    }

    private void stopAlarm() {
        Log.d(TAG, "Stopping alarm");
        stopAudioAndVibration();
        if (wakeLock != null && wakeLock.isHeld()) {
            try {
                wakeLock.release();
            } catch (Exception e) {}
        }
    }

    @Override
    public void onDestroy() {
        Log.d(TAG, "AlarmService destroyed");
        stopAlarm();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
