import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Bell, Clock, Moon, Sun, Volume2, Sparkles, Sliders, Info, VolumeX, X } from 'lucide-react';
import { Alarm } from './types';
import { LocalNotifications } from '@capacitor/local-notifications';
import { registerPlugin } from '@capacitor/core';
import AlarmCard from './components/AlarmCard';

const NativeAlarm = registerPlugin<any>('NativeAlarm');
import AlarmForm from './components/AlarmForm';
import AlarmModal from './components/AlarmModal';
import { stopAlarmSound } from './utils/audio';

// Seed initial values for first-time visits
const SEED_ALARMS: Alarm[] = [
  {
    id: 'seed-weekday',
    time: '07:15',
    enabled: true,
    label: 'Morning Mindfulness 🌿',
    days: [1, 2, 3, 4, 5], // Mon-Fri
    soundId: 'zen-chime',
    snoozeCount: 0,
    snoozeDuration: 5,
    isSnoozed: false,
    snoozedUntil: null,
  },
  {
    id: 'seed-weekend',
    time: '09:30',
    enabled: false,
    label: 'Weekend Slow Down ✨',
    days: [0, 6], // Sat, Sun
    soundId: 'cosmic-harmony',
    snoozeCount: 0,
    snoozeDuration: 10,
    isSnoozed: false,
    snoozedUntil: null,
  },
];

export default function App() {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [use24Hour, setUse24Hour] = useState<boolean>(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallHelp, setShowInstallHelp] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  
  // UI views
  const [showForm, setShowForm] = useState(false);
  const [alarmToEdit, setAlarmToEdit] = useState<Alarm | null>(null);
  const [activeRingingAlarm, setActiveRingingAlarm] = useState<Alarm | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const savedAlarms = localStorage.getItem('alarms_config');
    let loadedAlarms = SEED_ALARMS;
    if (savedAlarms) {
      try {
        loadedAlarms = JSON.parse(savedAlarms);
        setAlarms(loadedAlarms);
      } catch (e) {
        setAlarms(SEED_ALARMS);
      }
    } else {
      setAlarms(SEED_ALARMS);
      localStorage.setItem('alarms_config', JSON.stringify(SEED_ALARMS));
    }

    const savedFormat = localStorage.getItem('time_format_24h');
    if (savedFormat) {
      setUse24Hour(savedFormat === 'true');
    }

    // Load notification permission
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }

    // Check if running as standalone PWA
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
      setIsStandalone(true);
    }

    // Register Service Worker for background notifications
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          console.log('Service Worker registered successfully:', reg.scope);
          // Sync alarms initially
          setTimeout(() => {
            if (navigator.serviceWorker.controller) {
              navigator.serviceWorker.controller.postMessage({
                type: 'SET_ALARMS',
                alarms: loadedAlarms,
              });
            }
          }, 1000);
        })
        .catch((err) => {
          console.error('Service Worker registration failed:', err);
        });
    }

    // Register Capacitor Notification Actions
    if (typeof window !== 'undefined' && (window as any).Capacitor) {
      import('@capacitor/local-notifications').then(({ LocalNotifications }) => {
        LocalNotifications.createChannel({
          id: 'alarm_high_priority_v1',
          name: 'Срабатывание будильника',
          description: 'Уведомления во время звонка',
          importance: 5,
          visibility: 1,
          vibration: true,
        }).catch(console.error);

        LocalNotifications.registerActionTypes({
          types: [
            {
              id: 'ALARM_ACTIONS',
              actions: [
                {
                  id: 'snooze',
                  title: 'Отложить',
                  foreground: false
                },
                {
                  id: 'dismiss',
                  title: 'Выключить',
                  destructive: true,
                  foreground: false
                }
              ]
            }
          ]
        }).catch(console.error);

        LocalNotifications.addListener('localNotificationActionPerformed', (notificationAction) => {
          // You could parse the ID and find the alarm to actually snooze/dismiss it in state,
          // but state might not be accessible here due to closure.
          // We can dispatch a custom event.
          window.dispatchEvent(new CustomEvent('alarm-action', { detail: notificationAction }));
        });
      });
    }
  }, []);

  // Listen for beforeinstallprompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) {
      setShowInstallHelp(true);
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // Helper to sync alarms with the Service Worker and Capacitor LocalNotifications
  const syncAlarmsWithSW = async (updatedAlarms: Alarm[]) => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SET_ALARMS',
        alarms: updatedAlarms,
      });
    }

    try {
      if (typeof window !== 'undefined' && (window as any).Capacitor) {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        const isAndroid = typeof window !== 'undefined' && (window as any).Capacitor?.getPlatform() === 'android';

        if (isAndroid) {
            // Unschedule all existing alarms
            alarms.forEach(alarm => {
                const alarmIdNum = parseInt(alarm.id.replace(/\D/g, '').substring(0, 8), 10) || 0;
                if (alarm.days.length === 0) {
                   NativeAlarm.cancel({ id: alarmIdNum }).catch(() => {});
                } else {
                   alarm.days.forEach(day => {
                       NativeAlarm.cancel({ id: alarmIdNum + day }).catch(() => {});
                   });
                }
            });

            // Schedule new active ones
            updatedAlarms.forEach(alarm => {
              if (!alarm.enabled) return;
              
              const [alarmH, alarmM] = alarm.time.split(':').map(Number);
              const alarmIdNum = parseInt(alarm.id.replace(/\D/g, '').substring(0, 8), 10) || Math.floor(Math.random() * 100000);
              
              if (alarm.days.length === 0) {
                 const target = new Date(now);
                 target.setHours(alarmH, alarmM, 0, 0);
                 if (target.getTime() <= now.getTime()) {
                   target.setDate(target.getDate() + 1);
                 }
                 NativeAlarm.schedule({ id: alarmIdNum, time: target.getTime(), label: alarm.label }).catch(console.error);
              } else {
                 alarm.days.forEach(dayOfWeek => {
                   const target = new Date(now);
                   let diff = dayOfWeek - target.getDay();
                   if (diff < 0 || (diff === 0 && (target.getHours() > alarmH || (target.getHours() === alarmH && target.getMinutes() >= alarmM)))) {
                     diff += 7;
                   }
                   target.setDate(target.getDate() + diff);
                   target.setHours(alarmH, alarmM, 0, 0);
                   NativeAlarm.schedule({ id: alarmIdNum + dayOfWeek, time: target.getTime(), label: alarm.label }).catch(console.error);
                 });
              }
            });
        }

        // Keep LocalNotifications as a fallback or for the notification drawer / iOS
        // Clear all previous
        const pending = await LocalNotifications.getPending();
        if (pending.notifications.length > 0) {
          await LocalNotifications.cancel({ notifications: pending.notifications });
        }

        const notificationsToSchedule: any[] = [];
        const now = new Date();

        updatedAlarms.forEach((alarm) => {
          if (!alarm.enabled) return;

          const [alarmH, alarmM] = alarm.time.split(':').map(Number);
          const alarmIdNum = parseInt(alarm.id.replace(/\D/g, '').substring(0, 8), 10) || Math.floor(Math.random() * 100000);

          if (alarm.days.length === 0) {
            // One-time alarm
            const target = new Date(now);
            target.setHours(alarmH, alarmM, 0, 0);
            if (target.getTime() <= now.getTime()) {
              target.setDate(target.getDate() + 1);
            }
            notificationsToSchedule.push({
              title: alarm.label || 'Будильник',
              body: `Пора просыпаться! Время: ${alarm.time}`,
              id: alarmIdNum,
              schedule: { at: target, allowWhileIdle: true },
              actionTypeId: 'ALARM_ACTIONS',
              channelId: 'alarm_high_priority_v1',
            });
          } else {
            // Repeating alarm - schedule for the next week
            alarm.days.forEach(dayOfWeek => {
              const target = new Date(now);
              // Find next occurrence of this day
              let diff = dayOfWeek - target.getDay();
              if (diff < 0 || (diff === 0 && (target.getHours() > alarmH || (target.getHours() === alarmH && target.getMinutes() >= alarmM)))) {
                diff += 7;
              }
              target.setDate(target.getDate() + diff);
              target.setHours(alarmH, alarmM, 0, 0);

              notificationsToSchedule.push({
                title: alarm.label || 'Будильник',
                body: `Пора просыпаться! Время: ${alarm.time}`,
                id: alarmIdNum + dayOfWeek, // Unique ID per day
                schedule: { at: target, allowWhileIdle: true },
                actionTypeId: 'ALARM_ACTIONS',
                channelId: 'alarm_high_priority_v1',
              });
            });
          }
        });

        if (notificationsToSchedule.length > 0) {
          await LocalNotifications.schedule({ notifications: notificationsToSchedule });
        }
      }
    } catch (e) {
      console.error('Failed to schedule local notifications', e);
    }
  };

  // Save alarms to localStorage whenever they change
  const saveAlarms = (updatedAlarms: Alarm[]) => {
    setAlarms(updatedAlarms);
    localStorage.setItem('alarms_config', JSON.stringify(updatedAlarms));
    syncAlarmsWithSW(updatedAlarms);
  };

  useEffect(() => {
    const handleAlarmAction = (e: any) => {
      const action = e.detail;
      const alarmIdNum = action.notification.id;

      // Find the alarm by numeric ID match
      const matchingAlarm = alarms.find(a => {
        const idNum = parseInt(a.id.replace(/\D/g, '').substring(0, 8), 10);
        // Matching logic allows for +1 to +7 for dayOfWeek repeating alarms
        return idNum && alarmIdNum >= idNum && alarmIdNum <= idNum + 7;
      });

      if (!matchingAlarm) return;

      if (action.actionId === 'snooze') {
        const snoozeMs = matchingAlarm.snoozeDuration * 60 * 1000;
        const updated = alarms.map((al) => {
          if (al.id === matchingAlarm.id) {
            return {
              ...al,
              isSnoozed: true,
              snoozedUntil: Date.now() + snoozeMs,
              snoozeCount: al.snoozeCount + 1,
            };
          }
          return al;
        });
        saveAlarms(updated);
        // Also schedule a local notification for the snooze
        if (typeof window !== 'undefined' && (window as any).Capacitor) {
          const isAndroid = (window as any).Capacitor?.getPlatform() === 'android';
          if (isAndroid) {
              NativeAlarm.schedule({
                  id: alarmIdNum + 100, // offset id
                  time: Date.now() + snoozeMs,
                  label: matchingAlarm.label || 'Будильник'
              }).catch(console.error);
          } else {
            import('@capacitor/local-notifications').then(({ LocalNotifications }) => {
              LocalNotifications.schedule({
                notifications: [
                  {
                    title: 'Будильник отложен',
                    body: `Прозвонит снова через ${matchingAlarm.snoozeDuration} мин.`,
                    id: alarmIdNum + 100, // offset id
                    schedule: { at: new Date(Date.now() + snoozeMs), allowWhileIdle: true },
                    actionTypeId: 'ALARM_ACTIONS',
                    channelId: 'alarm_high_priority_v1',
                  }
                ]
              }).catch(console.error);
            });
          }
        }
      } else if (action.actionId === 'dismiss') {
        const updated = alarms.map((al) => {
          if (al.id === matchingAlarm.id) {
            return {
              ...al,
              isSnoozed: false,
              snoozedUntil: null,
              enabled: al.days.length > 0, // Disable if one-time
            };
          }
          return al;
        });
        saveAlarms(updated);
      }
      
      // Attempt to minimize app after action, ONLY if it wasn't a standard 'tap'
      if (action.actionId === 'snooze' || action.actionId === 'dismiss') {
          setActiveRingingAlarm(null);
          
          if (typeof window !== 'undefined' && (window as any).Capacitor) {
              import('@capacitor/app').then(({ App }) => {
                  App.minimizeApp().catch(console.error);
              });
          }
      }
    };

    window.addEventListener('alarm-action', handleAlarmAction);
    
    let nativeListener: any = null;
    if (typeof window !== 'undefined' && (window as any).Capacitor) {
       NativeAlarm.addListener('alarm-action', (data: any) => {
          // Normalize payload to match LocalNotification action shape
          window.dispatchEvent(new CustomEvent('alarm-action', { detail: {
             actionId: data.actionId,
             notification: { id: data.id }
          }}));
       }).then((l: any) => nativeListener = l);
    }

    return () => {
       window.removeEventListener('alarm-action', handleAlarmAction);
       if (nativeListener) {
           nativeListener.remove();
       }
    };
  }, [alarms]);

  // Request system notification permission
  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) return;
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        new Notification('🔔 Системные уведомления включены!', {
          body: 'Будильник будет присылать напоминания на рабочий стол.',
          tag: 'test-notification',
        });
      }
    } catch (e) {
      console.error('Failed to request notification permission:', e);
    }
  };

  // Clock tick & Alarm monitoring loop
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);

      const hoursStr = String(now.getHours()).padStart(2, '0');
      const minutesStr = String(now.getMinutes()).padStart(2, '0');
      const secondsStr = String(now.getSeconds()).padStart(2, '0');
      const currentDay = now.getDay();
      const currentTimestamp = now.getTime();

      // Check for active triggers
      alarms.forEach((alarm) => {
        if (!alarm.enabled || activeRingingAlarm?.id === alarm.id) return;

        // Trigger helper that raises UI and shows system notification
        const triggerAlarm = (targetAlarm: Alarm) => {
          setActiveRingingAlarm(targetAlarm);
          
          // Trigger system notification if permitted and not using Capacitor (since Capacitor schedules them natively)
          const isCapacitor = typeof window !== 'undefined' && (window as any).Capacitor;
          if (!isCapacitor && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(targetAlarm.label || 'Будильник', {
              body: `Пора просыпаться! Время: ${targetAlarm.time}`,
              requireInteraction: true,
              tag: targetAlarm.id,
            });
          }
        };

        // 1. Snoozed trigger check
        if (alarm.isSnoozed && alarm.snoozedUntil) {
          if (currentTimestamp >= alarm.snoozedUntil) {
            triggerAlarm(alarm);
          }
          return;
        }

        // 2. Standard alarm trigger check (triggers exactly on 00 seconds)
        if (!alarm.isSnoozed && secondsStr === '00' && alarm.time === `${hoursStr}:${minutesStr}`) {
          // Check day recurrence
          if (alarm.days.length === 0 || alarm.days.includes(currentDay)) {
            triggerAlarm(alarm);
          }
        }
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [alarms, activeRingingAlarm]);

  // Handle setting/updating alarm format
  const toggleTimeFormat = () => {
    const nextVal = !use24Hour;
    setUse24Hour(nextVal);
    localStorage.setItem('time_format_24h', String(nextVal));
  };

  // Check and request permissions
  const checkAndRequestPermissions = async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).Capacitor) {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        
        let permStatus = await LocalNotifications.checkPermissions();
        if (permStatus.display !== 'granted') {
          permStatus = await LocalNotifications.requestPermissions();
        }

        if (LocalNotifications.checkExactNotificationSetting && LocalNotifications.changeExactNotificationSetting) {
            const exactPerm = await LocalNotifications.checkExactNotificationSetting();
            if (exactPerm.exact_alarm !== 'granted') {
               await LocalNotifications.changeExactNotificationSetting();
            }
        }
      } else if ('Notification' in window) {
        if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
          await Notification.requestPermission();
        }
      }
    } catch (e) {
      console.error('Failed to request permissions', e);
    }
  };

  // Create or Update Alarm
  const handleSaveAlarm = async (formData: {
    time: string;
    label: string;
    days: number[];
    soundId: string;
    snoozeDuration: number;
  }) => {
    await checkAndRequestPermissions();
    if (alarmToEdit) {
      // Modify existing
      const updated = alarms.map((al) => {
        if (al.id === alarmToEdit.id) {
          return {
            ...al,
            ...formData,
            enabled: true, // Auto-enable modified alarm
            isSnoozed: false,
            snoozedUntil: null,
            snoozeCount: 0,
          };
        }
        return al;
      });
      saveAlarms(updated);
    } else {
      // Create new
      const newAlarm: Alarm = {
        id: `alarm-${Date.now()}`,
        ...formData,
        enabled: true,
        snoozeCount: 0,
        isSnoozed: false,
        snoozedUntil: null,
      };
      saveAlarms([...alarms, newAlarm]);
    }
    setShowForm(false);
    setAlarmToEdit(null);
  };

  // Toggle alarm enabled switch
  const handleToggleAlarm = async (alarmId: string) => {
    let shouldRequest = false;
    const updated = alarms.map((al) => {
      if (al.id === alarmId) {
        const nextEnabled = !al.enabled;
        if (nextEnabled) {
          shouldRequest = true;
        }
        return {
          ...al,
          enabled: nextEnabled,
          // Clear any active snoozes if turned off
          isSnoozed: false,
          snoozedUntil: null,
          snoozeCount: 0,
        };
      }
      return al;
    });

    if (shouldRequest) {
      await checkAndRequestPermissions();
    }

    saveAlarms(updated);

    // Stop ringing if we just toggled off the currently ringing alarm
    if (activeRingingAlarm?.id === alarmId) {
      stopAlarmSound();
      setActiveRingingAlarm(null);
    }
  };

  // Delete Alarm
  const handleDeleteAlarm = (alarmId: string) => {
    const updated = alarms.filter((al) => al.id !== alarmId);
    saveAlarms(updated);

    if (activeRingingAlarm?.id === alarmId) {
      stopAlarmSound();
      setActiveRingingAlarm(null);
    }
  };

  // Snooze active alarm
  const handleSnooze = (alarmId: string) => {
    const updated = alarms.map((al) => {
      if (al.id === alarmId) {
        const snoozeMinutes = al.snoozeDuration;
        const snoozeTime = Date.now() + snoozeMinutes * 60 * 1000;
        return {
          ...al,
          isSnoozed: true,
          snoozedUntil: snoozeTime,
          snoozeCount: al.snoozeCount + 1,
        };
      }
      return al;
    });
    saveAlarms(updated);
    setActiveRingingAlarm(null);
  };

  // Dismiss active alarm
  const handleDismiss = (alarmId: string) => {
    const updated = alarms.map((al) => {
      if (al.id === alarmId) {
        const isOnceOff = al.days.length === 0;
        return {
          ...al,
          enabled: !isOnceOff, // Disable once-off alarm after firing
          isSnoozed: false,
          snoozedUntil: null,
          snoozeCount: 0,
        };
      }
      return al;
    });
    saveAlarms(updated);
    setActiveRingingAlarm(null);
  };

  // Format Current Digital Display Clock
  const formatTimeParts = () => {
    let hours = currentTime.getHours();
    const minutes = String(currentTime.getMinutes()).padStart(2, '0');
    const seconds = currentTime.getSeconds();
    const ampm = hours >= 12 ? 'PM' : 'AM';

    if (!use24Hour) {
      hours = hours % 12;
      hours = hours ? hours : 12; // 0 hours is 12
    }

    const displayHours = String(hours).padStart(2, '0');

    return {
      hours: displayHours,
      minutes,
      seconds: String(seconds).padStart(2, '0'),
      ampm,
    };
  };

  const { hours, minutes, seconds, ampm } = formatTimeParts();
  const currentSecondsNum = currentTime.getSeconds();
  
  // Dynamic stroke dash offset for visual ticking seconds circle
  const circumference = 2 * Math.PI * 110; // r=110
  const strokeDashoffset = circumference - (currentSecondsNum / 60) * circumference;

  // Get time until next alarm
  const getNextAlarmText = () => {
    const activeAlarms = alarms.filter(a => a.enabled);
    if (activeAlarms.length === 0) return 'No Active Alarms';

    const now = new Date();
    let minTimeDiff = Infinity;

    activeAlarms.forEach((alarm) => {
      const [alarmH, alarmM] = alarm.time.split(':').map(Number);
      
      if (alarm.days.length === 0) {
        // Once-off alarm: check if today's time is in the future, else tomorrow
        const target = new Date(now);
        target.setHours(alarmH, alarmM, 0, 0);
        if (target.getTime() <= now.getTime()) {
          target.setDate(target.getDate() + 1);
        }
        const diff = target.getTime() - now.getTime();
        if (diff < minTimeDiff) {
          minTimeDiff = diff;
        }
      } else {
        // Repeated days: check today and next 7 days
        for (let i = 0; i < 7; i++) {
          const testDay = new Date(now);
          testDay.setDate(now.getDate() + i);
          const dayOfWeek = testDay.getDay();

          if (alarm.days.includes(dayOfWeek)) {
            const target = new Date(testDay);
            target.setHours(alarmH, alarmM, 0, 0);
            
            // If checking today and time is already passed, skip
            if (i === 0 && target.getTime() <= now.getTime()) {
              continue;
            }

            const diff = target.getTime() - now.getTime();
            if (diff < minTimeDiff) {
              minTimeDiff = diff;
            }
          }
        }
      }
    });

    if (minTimeDiff === Infinity) return 'No Active Alarms';

    // Format human-friendly time diff
    const totalMinutes = Math.round(minTimeDiff / (60 * 1000));
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    if (hours === 0) {
      if (mins === 0) return 'Alarm ringing now';
      return `Next alarm in ${mins} minute${mins !== 1 ? 's' : ''}`;
    }
    return `Next alarm in ${hours}h ${mins}m`;
  };

  // Format header date
  const formattedDate = currentTime.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div id="app-container" className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-start py-10 px-6 sm:px-8 md:py-16 selection:bg-indigo-500/30">
      <div className="w-full max-w-3xl flex flex-col space-y-12 md:space-y-16">
        
        {/* Bold Typography Header Section */}
        <header id="app-header" className="flex flex-col sm:flex-row justify-between items-start gap-6 w-full border-b border-zinc-900 pb-8">
          <div>
            <h2 className="text-xs uppercase tracking-[0.3em] text-zinc-500 font-bold mb-2">Current Date</h2>
            <p className="text-xl font-medium text-white">{formattedDate}</p>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-4 items-start w-full sm:w-auto">
            <div className="text-left sm:text-right">
              <h2 className="text-xs uppercase tracking-[0.3em] text-zinc-500 font-bold mb-2">Time Format</h2>
              <button
                id="format-toggle-btn"
                onClick={toggleTimeFormat}
                className="text-xl font-medium text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest cursor-pointer"
              >
                {use24Hour ? '24-Hour' : '12-Hour'}
              </button>
            </div>
          </div>
        </header>

        {/* Central Ambient Hero Clock Widget - Bold Typography Focus */}
        <section id="clock-hero" className="flex flex-col justify-center items-center py-6 w-full relative">
          <div className="relative">
            <h1 className="text-[90px] sm:text-[140px] md:text-[180px] lg:text-[210px] font-black leading-none tracking-[-0.06em] text-white flex items-baseline justify-center select-none">
              {hours}:{minutes}
              {!use24Hour && (
                <span className="text-2xl sm:text-3xl font-light tracking-widest text-zinc-600 ml-6 sm:ml-8 uppercase">
                  {ampm}
                </span>
              )}
            </h1>
            <div className="absolute -bottom-4 left-0 w-full flex justify-center">
              <div className="h-1 w-32 bg-indigo-500 rounded-full shadow-[0_0_12px_rgba(99,102,241,0.6)]"></div>
            </div>
          </div>
          <p className="mt-14 text-zinc-500 text-sm tracking-[0.25em] uppercase font-bold text-center">
            {getNextAlarmText()}
          </p>
        </section>

        {/* Alarms Subtitle & Add Control Bar */}
        <section id="alarms-section" className="space-y-6 pt-6">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
            <div className="flex items-center space-x-2">
              <h2 id="alarms-subtitle" className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                Active Alarms
              </h2>
              <span id="alarms-count-badge" className="text-xs font-bold px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-400 border border-zinc-800">
                {alarms.length}
              </span>
            </div>

            <button
              id="add-alarm-btn"
              onClick={() => {
                setAlarmToEdit(null);
                setShowForm(true);
              }}
              className="px-6 py-2 bg-white text-black text-xs font-bold uppercase tracking-widest rounded-full hover:bg-zinc-200 transition-all cursor-pointer shadow-sm"
            >
              Add Alarm
            </button>
          </div>

          {/* List of Alarms */}
          <div id="alarms-list" className="grid grid-cols-1 sm:grid-cols-2 gap-6 min-h-[120px]">
            <AnimatePresence mode="popLayout">
              {alarms.length > 0 ? (
                alarms.map((alarm) => (
                  <AlarmCard
                    key={alarm.id}
                    alarm={alarm}
                    use24Hour={use24Hour}
                    onToggle={handleToggleAlarm}
                    onEdit={(al) => {
                      setAlarmToEdit(al);
                      setShowForm(true);
                    }}
                    onDelete={handleDeleteAlarm}
                  />
                ))
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  id="no-alarms-prompt"
                  className="col-span-full flex flex-col items-center justify-center py-14 px-6 rounded-[32px] border border-dashed border-zinc-800 bg-zinc-950/20 text-center"
                >
                  <Clock size={28} className="text-zinc-700 mb-3 animate-pulse" />
                  <p className="text-sm font-bold uppercase tracking-wider text-zinc-400">No alarms set</p>
                  <p className="text-xs text-zinc-600 mt-2 max-w-xs leading-relaxed font-medium">
                    Create a customized chime to help you wake up gently.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>



        {/* Floating Alarms Forms Overlay */}
        <AnimatePresence>
          {showForm && (
            <AlarmForm
              alarmToEdit={alarmToEdit}
              onSave={handleSaveAlarm}
              onCancel={() => {
                setShowForm(false);
                setAlarmToEdit(null);
              }}
            />
          )}
        </AnimatePresence>

        {/* Fullscreen Ringing Modal Overlay */}
        <AnimatePresence>
          {activeRingingAlarm && (
            <AlarmModal
              alarm={activeRingingAlarm}
              onDismiss={handleDismiss}
              onSnooze={handleSnooze}
            />
          )}
        </AnimatePresence>

        {/* Standalone Installation Guide Modal */}
        <AnimatePresence>
          {showInstallHelp && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowInstallHelp(false)}
                className="absolute inset-0 bg-black/85 backdrop-blur-sm"
              />
              {/* Card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: 'spring', duration: 0.5 }}
                className="relative bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 max-w-lg w-full text-zinc-100 shadow-2xl z-10 overflow-hidden"
              >
                {/* Background ambient glow */}
                <div className="absolute -top-32 -left-32 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

                <button
                  onClick={() => setShowInstallHelp(false)}
                  className="absolute top-6 right-6 p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>

                <div className="flex items-center space-x-3 mb-6">
                  <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20">
                    <Sparkles size={24} className="animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold tracking-tight text-white">Установка приложения (PWA)</h3>
                    <p className="text-xs text-zinc-500 font-semibold tracking-wide uppercase mt-0.5">Standalone Автономный Режим</p>
                  </div>
                </div>

                <div className="space-y-5 text-sm leading-relaxed text-zinc-300">
                  <p>
                    Вы можете установить этот будильник как полноценное приложение на ваше устройство. Оно будет работать локально, автономно (даже без интернета) и без лишнего браузерного интерфейса!
                  </p>

                  <div className="border-t border-zinc-800/80 my-2 pt-4 space-y-4">
                    <div className="flex items-start space-x-3">
                      <span className="flex items-center justify-center bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 text-xs font-bold w-6 h-6 rounded-full shrink-0 mt-0.5">1</span>
                      <div>
                        <p className="font-bold text-white text-xs uppercase tracking-wider mb-1">Компьютер (Chrome / Edge / Safari)</p>
                        <p className="text-xs text-zinc-400">Нажмите на иконку <strong>«Установить приложение»</strong> в верхнем правом углу адресной строки браузера или нажмите кнопку «Install App» в заголовке будильника.</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <span className="flex items-center justify-center bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 text-xs font-bold w-6 h-6 rounded-full shrink-0 mt-0.5">2</span>
                      <div>
                        <p className="font-bold text-white text-xs uppercase tracking-wider mb-1">Android (Chrome / Samsung Internet)</p>
                        <p className="text-xs text-zinc-400">Нажмите «Установить» во всплывающем окне, либо откройте меню браузера (три точки) и выберите <strong>«Добавить на главный экран»</strong> или <strong>«Установить приложение»</strong>.</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <span className="flex items-center justify-center bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 text-xs font-bold w-6 h-6 rounded-full shrink-0 mt-0.5">3</span>
                      <div>
                        <p className="font-bold text-white text-xs uppercase tracking-wider mb-1">Apple iOS (iPhone / iPad)</p>
                        <p className="text-xs text-zinc-400">Откройте этот сайт в Safari, нажмите кнопку <strong>«Поделиться» (Share)</strong> внизу экрана, выберите пункт <strong>«На экран „Домой“» (Add to Home Screen)</strong>.</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-zinc-950/40 border border-zinc-800 rounded-2xl text-xs text-zinc-500 leading-normal">
                    💡 <strong>Преимущество standalone-режима:</strong> Когда вы запускаете приложение с главного экрана или рабочего стола, браузер разрешает автоматическое воспроизведение звуков (без предварительного клика) при срабатывании будильника!
                  </div>
                </div>

                <div className="mt-8 flex justify-end">
                  <button
                    onClick={() => setShowInstallHelp(false)}
                    className="px-6 py-2.5 bg-white text-black hover:bg-zinc-200 text-xs font-bold uppercase tracking-widest rounded-full transition-all cursor-pointer"
                  >
                    Понятно
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
