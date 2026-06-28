package com.minimalist.alarmclock.plugins;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeAlarm")
public class NativeAlarmPlugin extends Plugin {

    private BroadcastReceiver actionReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if ("com.minimalist.alarmclock.ALARM_ACTION".equals(intent.getAction())) {
                int id = intent.getIntExtra("id", 0);
                String action = intent.getStringExtra("action");
                
                JSObject ret = new JSObject();
                ret.put("id", id);
                ret.put("actionId", action);
                notifyListeners("alarm-action", ret);
            }
        }
    };

    @Override
    public void load() {
        super.load();
        IntentFilter filter = new IntentFilter("com.minimalist.alarmclock.ALARM_ACTION");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(actionReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(actionReceiver, filter);
        }
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        try {
            getContext().unregisterReceiver(actionReceiver);
        } catch (Exception e) {}
    }

    @PluginMethod
    public void schedule(PluginCall call) {
        Integer id = call.getInt("id");
        Long time = call.getLong("time");
        String label = call.getString("label", "Alarm");

        if (id == null || time == null) {
            call.reject("Must provide an id and time");
            return;
        }

        Context context = getContext();
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);

        Intent intent = new Intent(context, AlarmReceiver.class);
        intent.setAction("com.minimalist.alarmclock.ALARM_TRIGGER_" + id);
        intent.setData(android.net.Uri.parse("alarm://" + id));
        intent.putExtra("id", id);
        intent.putExtra("label", label);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent pendingIntent = PendingIntent.getBroadcast(context, id, intent, flags);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                Intent showIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
                if (showIntent == null) {
                    showIntent = new Intent();
                }
                PendingIntent showPendingIntent = PendingIntent.getActivity(context, id, showIntent, flags);
                alarmManager.setAlarmClock(new AlarmManager.AlarmClockInfo(time, showPendingIntent), pendingIntent);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, time, pendingIntent);
            } else {
                alarmManager.set(AlarmManager.RTC_WAKEUP, time, pendingIntent);
            }
        } catch (SecurityException e) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (!alarmManager.canScheduleExactAlarms()) {
                    try {
                        Intent permissionIntent = new Intent(android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                        permissionIntent.setData(android.net.Uri.parse("package:" + context.getPackageName()));
                        permissionIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        context.startActivity(permissionIntent);
                    } catch (Exception ex) {
                        try {
                            Intent permissionIntent = new Intent(android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                            permissionIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            context.startActivity(permissionIntent);
                        } catch (Exception ex2) {}
                    }
                    call.reject("Missing exact alarm permission. Opening settings...");
                    return;
                }
            }
            call.reject("SecurityException when scheduling alarm: " + e.getMessage());
            return;
        }

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void checkIntent(PluginCall call) {
        Intent intent = getActivity().getIntent();
        if (intent != null && intent.hasExtra("alarm_action")) {
            String action = intent.getStringExtra("alarm_action");
            int id = intent.getIntExtra("alarm_id", 0);
            
            // clear the intent so it doesn't trigger again
            intent.removeExtra("alarm_action");
            intent.removeExtra("alarm_id");

            JSObject ret = new JSObject();
            ret.put("id", id);
            ret.put("actionId", action);
            call.resolve(ret);
        } else {
            call.resolve(new JSObject());
        }
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        Integer id = call.getInt("id");
        if (id == null) {
            call.reject("Must provide an id");
            return;
        }

        Context context = getContext();
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);

        Intent intent = new Intent(context, AlarmReceiver.class);
        intent.setAction("com.minimalist.alarmclock.ALARM_TRIGGER_" + id);
        intent.setData(android.net.Uri.parse("alarm://" + id));
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent pendingIntent = PendingIntent.getBroadcast(context, id, intent, flags);
        alarmManager.cancel(pendingIntent);

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestBatteryOptimization(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Context context = getContext();
            String packageName = context.getPackageName();
            android.os.PowerManager pm = (android.os.PowerManager) context.getSystemService(Context.POWER_SERVICE);
            if (!pm.isIgnoringBatteryOptimizations(packageName)) {
                try {
                    Intent intent = new Intent();
                    intent.setAction(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(android.net.Uri.parse("package:" + packageName));
                    intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(intent);
                } catch (Exception e) {}
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void checkBatteryOptimization(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Context context = getContext();
            String packageName = context.getPackageName();
            android.os.PowerManager pm = (android.os.PowerManager) context.getSystemService(Context.POWER_SERVICE);
            ret.put("isOptimized", !pm.isIgnoringBatteryOptimizations(packageName));
        } else {
            ret.put("isOptimized", false);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void checkOverlayPermission(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            ret.put("granted", android.provider.Settings.canDrawOverlays(getContext()));
        } else {
            ret.put("granted", true);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void requestOverlayPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Context context = getContext();
            if (!android.provider.Settings.canDrawOverlays(context)) {
                try {
                    Intent intent = new Intent(android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION);
                    intent.setData(android.net.Uri.parse("package:" + context.getPackageName()));
                    intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(intent);
                } catch (Exception e) {
                    try {
                        Intent intent = new Intent(android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION);
                        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        context.startActivity(intent);
                    } catch (Exception ex) {}
                }
            }
        }
        call.resolve();
    }
}
