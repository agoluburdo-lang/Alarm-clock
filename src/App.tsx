import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Bell, Clock, Moon, Sun, Volume2, Sparkles, Sliders, Info, VolumeX, X } from 'lucide-react';
import { Alarm } from './types';
import AlarmCard from './components/AlarmCard';
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

  // Helper to sync alarms with the Service Worker
  const syncAlarmsWithSW = (updatedAlarms: Alarm[]) => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SET_ALARMS',
        alarms: updatedAlarms,
      });
    }
  };

  // Save alarms to localStorage whenever they change
  const saveAlarms = (updatedAlarms: Alarm[]) => {
    setAlarms(updatedAlarms);
    localStorage.setItem('alarms_config', JSON.stringify(updatedAlarms));
    syncAlarmsWithSW(updatedAlarms);
  };

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
          
          // Trigger system notification if permitted
          if ('Notification' in window && Notification.permission === 'granted') {
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

  // Create or Update Alarm
  const handleSaveAlarm = (formData: {
    time: string;
    label: string;
    days: number[];
    soundId: string;
    snoozeDuration: number;
  }) => {
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
  const handleToggleAlarm = (alarmId: string) => {
    const updated = alarms.map((al) => {
      if (al.id === alarmId) {
        const nextEnabled = !al.enabled;
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
            <div className="min-w-[120px]">
              <h2 className="text-xs uppercase tracking-[0.3em] text-zinc-500 font-bold mb-2">Background Alerts</h2>
              {notificationPermission === 'granted' ? (
                <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                  </span>
                  <span>Active</span>
                </div>
              ) : notificationPermission === 'denied' ? (
                <span className="text-rose-400 font-bold text-xs uppercase tracking-wider block" title="Enable notifications in browser settings for background alarm functionality">
                  Blocked ⚠️
                </span>
              ) : (
                <button
                  id="enable-notifications-btn"
                  onClick={requestNotificationPermission}
                  className="text-xs font-bold uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                >
                  Enable 🔔
                </button>
              )}
            </div>
            <div className="min-w-[120px]">
              <h2 className="text-xs uppercase tracking-[0.3em] text-zinc-500 font-bold mb-2">Standalone App</h2>
              {isStandalone ? (
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                  <span className="relative flex h-2 w-2">
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>Installed 💻</span>
                </div>
              ) : (
                <button
                  id="install-pwa-btn"
                  onClick={handleInstallApp}
                  className="text-xs font-bold uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                >
                  Install App 📱
                </button>
              )}
            </div>
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

        {/* Informational persistent footnote */}
        <footer id="app-footer-info" className="flex items-start space-x-3 bg-zinc-900/20 border border-zinc-800/60 rounded-[24px] p-6 text-xs text-zinc-500">
          <Info size={16} className="text-indigo-400 shrink-0 mt-0.5" />
          <div className="space-y-1.5 font-medium leading-relaxed">
            <p>
              Your configurations are securely persisted in local storage. To guarantee a loud audio alarm chime, we recommend keeping this browser tab open.
            </p>
            <p className="text-indigo-400/80">
              ⚡ <strong>Closed Tab Support:</strong> We have registered a Service Worker with Desktop Notification triggers. If you permit notifications, the system will send you immediate alerts even if this application tab or browser is completely closed!
            </p>
          </div>
        </footer>

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
