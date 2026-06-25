import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Alarm } from '../types';
import { startAlarmSound, stopAlarmSound } from '../utils/audio';
import { Bell, BellOff, Hourglass, Sparkles } from 'lucide-react';

interface AlarmModalProps {
  alarm: Alarm;
  onDismiss: (alarmId: string) => void;
  onSnooze: (alarmId: string) => void;
}

export default function AlarmModal({ alarm, onDismiss, onSnooze }: AlarmModalProps) {
  const [timeStr, setTimeStr] = useState('');
  const [ampmStr, setAmpmStr] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    // Start playing sound (unless Android native handles it)
    const isAndroid = typeof window !== 'undefined' && (window as any).Capacitor?.getPlatform() === 'android';
    if (!isAndroid) {
        startAlarmSound(alarm.soundId);
    }

    // Track active ringing time
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // 0 should be 12
      setTimeStr(`${String(hours).padStart(2, '0')}:${minutes}:${seconds}`);
      setAmpmStr(ampm);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);

    const secondsTimer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      stopAlarmSound();
      clearInterval(timer);
      clearInterval(secondsTimer);
    };
  }, [alarm]);

  // Clean, glowing animations
  const pulseVariants = {
    pulse: {
      scale: [1, 1.15, 1],
      opacity: [0.15, 0.4, 0.15],
      transition: {
        duration: 3,
        repeat: Infinity,
        ease: 'easeInOut',
      },
    },
    doublePulse: {
      scale: [1.1, 1.35, 1.1],
      opacity: [0.08, 0.25, 0.08],
      transition: {
        duration: 3,
        delay: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      },
    },
  };

  return (
    <div
      id="alarm-trigger-overlay"
      className="fixed inset-0 bg-zinc-950/95 backdrop-blur-xl z-50 flex flex-col items-center justify-between p-8 overflow-hidden select-none"
    >
      {/* Background ambient glowing rings */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
        <motion.div
          variants={pulseVariants}
          animate="pulse"
          className="absolute w-[300px] h-[300px] sm:w-[500px] sm:h-[500px] rounded-full border border-indigo-500/30 bg-indigo-500/5 filter blur-sm"
        />
        <motion.div
          variants={pulseVariants}
          animate="doublePulse"
          className="absolute w-[450px] h-[450px] sm:w-[750px] sm:h-[750px] rounded-full border border-violet-500/20 bg-violet-500/3 filter blur-md"
        />
        <div className="absolute inset-0 bg-radial from-transparent via-zinc-950/70 to-zinc-950" />
      </div>

      {/* Top Section - Status & Sparkles */}
      <div className="relative z-10 flex flex-col items-center mt-8 space-y-2">
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="flex items-center space-x-2 px-4 py-1.5 rounded-full bg-zinc-900/80 border border-zinc-800 text-indigo-400 text-xs font-semibold tracking-widest uppercase shadow-lg shadow-indigo-500/5"
        >
          <Sparkles size={12} className="animate-pulse text-indigo-400" />
          <span>Alarm Ringing</span>
        </motion.div>
        
        {alarm.snoozeCount > 0 && (
          <p id="snooze-count-tag" className="text-xs text-amber-400 font-medium font-mono">
            Snoozed {alarm.snoozeCount} time{alarm.snoozeCount > 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Middle Section - Big Typography Current Clock */}
      <div className="relative z-10 text-center space-y-6 my-auto">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', delay: 0.1, duration: 0.6 }}
          className="flex flex-col items-center justify-center"
        >
          <div className="flex items-baseline space-x-3">
            <h1 id="alarm-clock-display" className="text-6xl sm:text-8xl font-sans font-black tracking-tight text-white filter drop-shadow-[0_0_20px_rgba(255,255,255,0.15)]">
              {timeStr}
            </h1>
            <span className="text-2xl sm:text-4xl font-light tracking-widest text-zinc-500 uppercase ml-4">
              {ampmStr}
            </span>
          </div>

          <p id="alarm-label-display" className="text-xl sm:text-2xl font-medium text-indigo-300 mt-6 tracking-wide max-w-md px-4 truncate">
            {alarm.label || 'Alarm'}
          </p>
        </motion.div>

        {/* Oscillating ringing icon */}
        <motion.div
          animate={{
            rotate: [-8, 8, -8],
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 0.4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="inline-flex items-center justify-center p-5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 shadow-[0_0_30px_rgba(99,102,241,0.15)]"
        >
          <Bell size={36} fill="currentColor" className="opacity-90" />
        </motion.div>
      </div>

      {/* Bottom Section - Sleek Dual CTA Actions */}
      <div className="relative z-10 w-full max-w-md flex flex-col space-y-4 mb-12">
        <div className="grid grid-cols-2 gap-4">
          {/* Snooze Trigger */}
          {alarm.snoozeDuration > 0 ? (
            <motion.button
              id="snooze-alarm-btn"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                stopAlarmSound();
                onSnooze(alarm.id);
              }}
              className="flex flex-col items-center justify-center p-4 rounded-3xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-850 transition-all shadow-lg active:ring-2 active:ring-zinc-700/50"
            >
              <Hourglass size={20} className="text-amber-400 mb-1.5" />
              <span className="text-xs uppercase tracking-widest font-bold">Snooze</span>
              <span className="text-[10px] text-zinc-500 font-mono mt-0.5">
                {alarm.snoozeDuration} minutes
              </span>
            </motion.button>
          ) : (
            <div className="flex flex-col items-center justify-center p-4 rounded-3xl bg-zinc-900/40 border border-zinc-850 text-zinc-600">
              <Hourglass size={20} className="mb-1.5 opacity-30" />
              <span className="text-xs uppercase tracking-widest font-bold">Snooze</span>
              <span className="text-[10px] mt-0.5">Disabled</span>
            </div>
          )}

          {/* Dismiss Trigger */}
          <motion.button
            id="dismiss-alarm-btn"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              stopAlarmSound();
              onDismiss(alarm.id);
            }}
            className="flex flex-col items-center justify-center p-4 rounded-3xl bg-white text-black font-bold hover:bg-zinc-200 transition-all shadow-xl"
          >
            <BellOff size={20} className="mb-1.5 text-black" />
            <span className="text-xs uppercase tracking-widest font-bold">Dismiss</span>
            <span className="text-[10px] text-zinc-800 font-semibold mt-0.5">
              Stop Ringing
            </span>
          </motion.button>
        </div>

        {/* Helper auto-dismiss reminder */}
        <p className="text-[11px] text-center text-zinc-600">
          Ringing for {elapsedSeconds}s. Alarm will auto-snooze after 5 minutes if uninterrupted.
        </p>
      </div>
    </div>
  );
}
