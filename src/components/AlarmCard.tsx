import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Edit2, Trash2, Volume2, Calendar, Hourglass } from 'lucide-react';
import { Alarm, SOUND_OPTIONS } from '../types';

interface AlarmCardProps {
  key?: string;
  alarm: Alarm;
  use24Hour: boolean;
  onToggle: (alarmId: string) => void;
  onEdit: (alarm: Alarm) => void;
  onDelete: (alarmId: string) => void;
}

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AlarmCard({ alarm, use24Hour, onToggle, onEdit, onDelete }: AlarmCardProps) {
  const [snoozeCountdown, setSnoozeCountdown] = useState('');

  // Update countdown for snoozed alarm
  useEffect(() => {
    if (!alarm.isSnoozed || !alarm.snoozedUntil) {
      setSnoozeCountdown('');
      return;
    }

    const updateCountdown = () => {
      const now = Date.now();
      const diff = alarm.snoozedUntil! - now;

      if (diff <= 0) {
        setSnoozeCountdown('Triggering now...');
        return;
      }

      const totalSecs = Math.floor(diff / 1000);
      const mins = Math.floor(totalSecs / 60);
      const secs = totalSecs % 60;
      setSnoozeCountdown(`${mins}m ${secs}s left`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [alarm.isSnoozed, alarm.snoozedUntil]);

  // Format 24h time to 12h if requested
  const formatDisplayTime = (time24: string) => {
    if (use24Hour) return time24;
    const [hStr, mStr] = time24.split(':');
    const h = parseInt(hStr, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    return `${displayH}:${mStr} ${ampm}`;
  };

  // Find sound name
  const soundName = SOUND_OPTIONS.find((s) => s.id === alarm.soundId)?.name || 'Zen Chime';

  // Summarize recurrences
  const getRecurrenceText = () => {
    if (alarm.days.length === 0) return 'Once (Today/Tomorrow)';
    if (alarm.days.length === 7) return 'Every day';
    if (alarm.days.length === 5 && !alarm.days.includes(0) && !alarm.days.includes(6)) return 'Weekdays';
    if (alarm.days.length === 2 && alarm.days.includes(0) && alarm.days.includes(6)) return 'Weekends';
    
    // Sort and map
    return alarm.days.map((d) => DAYS_SHORT[d]).join(', ');
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      id={`alarm-card-${alarm.id}`}
      className={`relative group p-8 rounded-[32px] border transition-all ${
        alarm.enabled
          ? 'bg-zinc-900/50 border-indigo-500/40 ring-1 ring-indigo-500/10 shadow-[0_8px_32px_rgba(99,102,241,0.06)]'
          : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700/60'
      }`}
    >
      <div className="flex flex-col gap-4">
        {/* Top row: Time and Toggle Switch */}
        <div className="flex justify-between items-start">
          <div className="flex items-baseline space-x-2">
            <h3
              id={`alarm-time-display-${alarm.id}`}
              className={`text-4xl font-bold tracking-tight transition-colors duration-200 ${
                alarm.enabled ? 'text-white' : 'text-zinc-400'
              }`}
            >
              {formatDisplayTime(alarm.time)}
            </h3>
            
            {/* Enabled badge or status display */}
            {alarm.isSnoozed && alarm.enabled && (
              <span id="snooze-active-badge" className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1 font-sans">
                <Hourglass size={10} className="animate-spin" /> Snoozed
              </span>
            )}
          </div>

          {/* Theme Custom Toggle Switch */}
          <button
            id={`toggle-alarm-btn-${alarm.id}`}
            onClick={() => onToggle(alarm.id)}
            className={`w-12 h-6 rounded-full relative flex items-center transition-all cursor-pointer focus:outline-none ${
              alarm.enabled
                ? 'bg-indigo-600 justify-end px-1'
                : 'bg-zinc-800 justify-start px-1'
            }`}
          >
            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-all`} />
          </button>
        </div>

        {/* Info/Label row */}
        <div className="flex flex-col">
          <span
            id={`alarm-label-${alarm.id}`}
            className={`text-sm font-medium ${
              alarm.enabled ? 'text-zinc-300' : 'text-zinc-500'
            }`}
          >
            {alarm.label || 'Alarm'}
          </span>
          <span
            className={`text-xs mt-1 font-medium tracking-wide ${
              alarm.enabled ? 'text-indigo-400/85' : 'text-zinc-600'
            }`}
          >
            {getRecurrenceText()}
          </span>
        </div>

        {/* Bottom utility controls: Sound Name, Edit/Delete tools */}
        <div className="flex items-center justify-between pt-3 border-t border-zinc-800/40">
          <span className="text-[10px] uppercase tracking-widest font-mono font-medium text-zinc-500 flex items-center gap-1">
            <Volume2 size={11} className="opacity-70" />
            {soundName}
          </span>

          <div className="flex items-center space-x-2">
            <button
              id={`edit-alarm-btn-${alarm.id}`}
              onClick={() => onEdit(alarm)}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer"
              title="Edit Alarm"
            >
              <Edit2 size={14} />
            </button>
            <button
              id={`delete-alarm-btn-${alarm.id}`}
              onClick={() => onDelete(alarm.id)}
              className="p-2 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
              title="Delete Alarm"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Snooze Countdown banner at the bottom */}
      {alarm.isSnoozed && alarm.enabled && snoozeCountdown && (
        <div id="snooze-banner" className="mt-4 pt-3 border-t border-zinc-850/60 flex items-center justify-between text-xs text-amber-400 font-mono">
          <span className="flex items-center gap-1.5 opacity-85">
            <Hourglass size={12} /> Snooze active
          </span>
          <span className="font-bold tracking-tight">{snoozeCountdown}</span>
        </div>
      )}
    </motion.div>
  );
}
