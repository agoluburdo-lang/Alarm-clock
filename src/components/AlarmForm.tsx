import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Volume2, Play, Square, Info } from 'lucide-react';
import { Alarm, SOUND_OPTIONS, SoundOption } from '../types';
import { playSoundPreview, stopAlarmSound } from '../utils/audio';

interface AlarmFormProps {
  alarmToEdit?: Alarm | null;
  onSave: (data: {
    time: string;
    label: string;
    days: number[];
    soundId: string;
    snoozeDuration: number;
  }) => void;
  onCancel: () => void;
}

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AlarmForm({ alarmToEdit, onSave, onCancel }: AlarmFormProps) {
  const [time, setTime] = useState('07:00');
  const [label, setLabel] = useState('');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [soundId, setSoundId] = useState('zen-chime');
  const [snoozeDuration, setSnoozeDuration] = useState(5);
  const [playingPreview, setPlayingPreview] = useState<string | null>(null);

  useEffect(() => {
    if (alarmToEdit) {
      setTime(alarmToEdit.time);
      setLabel(alarmToEdit.label);
      setSelectedDays(alarmToEdit.days);
      setSoundId(alarmToEdit.soundId);
      setSnoozeDuration(alarmToEdit.snoozeDuration);
    } else {
      // Default set to 10 mins from now or standard 07:00
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      setTime(`${hours}:${minutes}`);
      setLabel('');
      setSelectedDays([]);
      setSoundId('zen-chime');
      setSnoozeDuration(5);
    }
    return () => {
      stopAlarmSound();
    };
  }, [alarmToEdit]);

  const handleToggleDay = (dayIndex: number) => {
    setSelectedDays((prev) =>
      prev.includes(dayIndex)
        ? prev.filter((d) => d !== dayIndex)
        : [...prev, dayIndex].sort((a, b) => a - b)
    );
  };

  const handlePreviewSound = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (playingPreview === id) {
      stopAlarmSound();
      setPlayingPreview(null);
    } else {
      playSoundPreview(id);
      setPlayingPreview(id);
      // Automatically reset preview state after 2.5s (corresponds to audio duration)
      setTimeout(() => {
        setPlayingPreview((curr) => (curr === id ? null : curr));
      }, 2500);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      time,
      label: label.trim() || 'Alarm',
      days: selectedDays,
      soundId,
      snoozeDuration,
    });
  };

  // Pre-calculate am/pm display for preview
  const getAmPmDisplay = (t: string) => {
    const [hStr, mStr] = t.split(':');
    const h = parseInt(hStr, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    return `${displayH}:${mStr} ${ampm}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      id="alarm-form-overlay"
      className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
      onClick={() => {
        stopAlarmSound();
        onCancel();
      }}
    >
      <motion.div
        initial={{ scale: 0.95, y: 15 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 15 }}
        transition={{ type: 'spring', duration: 0.4 }}
        id="alarm-form-card"
        className="bg-zinc-900 border border-zinc-800/80 w-full max-w-lg rounded-[32px] overflow-hidden shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-zinc-800/60 bg-zinc-900/50">
          <h2 id="form-title" className="text-sm uppercase tracking-[0.3em] font-bold text-zinc-100">
            {alarmToEdit ? 'Edit Alarm' : 'New Alarm'}
          </h2>
          <button
            id="close-form-btn"
            onClick={() => {
              stopAlarmSound();
              onCancel();
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {/* Time Selector */}
          <div className="space-y-2">
            <label id="time-label" className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 block">
              Time
            </label>
            <div className="relative flex items-center justify-center bg-zinc-950/60 rounded-2xl p-6 border border-zinc-800/40">
              <input
                id="alarm-time-input"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                className="text-4xl sm:text-5xl font-sans font-black tracking-tight bg-transparent text-white focus:outline-none cursor-pointer w-full text-center select-all"
              />
              <div className="absolute right-6 bottom-3 text-xs font-mono text-zinc-500 uppercase tracking-widest font-semibold">
                {getAmPmDisplay(time)}
              </div>
            </div>
          </div>

          {/* Alarm Label */}
          <div className="space-y-2">
            <label id="label-title" className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 block">
              Label
            </label>
            <input
              id="alarm-label-input"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Good Morning, Wake Up..."
              maxLength={40}
              className="w-full bg-zinc-950/40 border border-zinc-800 rounded-xl px-4 py-3.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-all focus:ring-1 focus:ring-indigo-500/20"
            />
          </div>

          {/* Day Repeater */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label id="repeat-label" className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                Repeat Days
              </label>
              <span id="repeat-status" className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
                {selectedDays.length === 0
                  ? 'Once'
                  : selectedDays.length === 7
                  ? 'Every Day'
                  : selectedDays.length === 5 && !selectedDays.includes(0) && !selectedDays.includes(6)
                  ? 'Weekdays'
                  : 'Custom'}
              </span>
            </div>
            <div id="days-container" className="grid grid-cols-7 gap-1.5 pt-1">
              {DAYS_SHORT.map((day, idx) => {
                const isActive = selectedDays.includes(idx);
                return (
                  <button
                    key={day}
                    id={`day-btn-${idx}`}
                    type="button"
                    onClick={() => handleToggleDay(idx)}
                    className={`h-10 text-[11px] font-bold rounded-lg border transition-all ${
                      isActive
                        ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 font-extrabold shadow-[0_0_6px_rgba(99,102,241,0.08)]'
                        : 'bg-zinc-950/40 text-zinc-400 border-zinc-800/80 hover:border-zinc-700'
                    }`}
                  >
                    {day[0]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Alarm Sound Picker */}
          <div className="space-y-2">
            <label id="sound-label" className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 block">
              Sound Theme
            </label>
            <div id="sounds-list" className="space-y-2">
              {SOUND_OPTIONS.map((sound) => {
                const isSelected = soundId === sound.id;
                const isPlaying = playingPreview === sound.id;
                return (
                  <div
                    key={sound.id}
                    id={`sound-item-${sound.id}`}
                    onClick={() => setSoundId(sound.id)}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-zinc-800/30 border-indigo-500/30 text-zinc-100 shadow-sm'
                        : 'bg-zinc-950/20 border-zinc-900/80 text-zinc-400 hover:bg-zinc-950/40 hover:text-zinc-200'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div
                        className={`p-2 rounded-lg mt-0.5 ${
                          isSelected ? 'bg-indigo-500/10 text-indigo-400' : 'bg-zinc-900 text-zinc-500'
                        }`}
                      >
                        <Volume2 size={15} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{sound.name}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{sound.description}</p>
                      </div>
                    </div>
                    
                    {/* Play/Stop Preview */}
                    <button
                      id={`preview-sound-btn-${sound.id}`}
                      type="button"
                      onClick={(e) => handlePreviewSound(sound.id, e)}
                      className={`p-2 rounded-lg border transition-all flex items-center justify-center ${
                        isPlaying
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : isSelected
                          ? 'bg-zinc-900 text-zinc-300 border-zinc-700/60 hover:bg-zinc-800'
                          : 'bg-zinc-950/50 text-zinc-500 border-zinc-900 hover:text-zinc-300 hover:bg-zinc-900'
                      }`}
                      title={isPlaying ? 'Stop Preview' : 'Play Preview'}
                    >
                      {isPlaying ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Snooze Duration */}
          <div className="space-y-3 pt-1">
            <div className="flex justify-between items-center text-xs">
              <label id="snooze-label" className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                Snooze Interval
              </label>
              <span id="snooze-duration" className="font-mono font-bold text-indigo-400">
                {snoozeDuration === 0 ? 'Disabled' : `${snoozeDuration} mins`}
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <input
                id="snooze-slider"
                type="range"
                min="0"
                max="30"
                step="1"
                value={snoozeDuration}
                onChange={(e) => setSnoozeDuration(parseInt(e.target.value, 10))}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>
            {snoozeDuration === 0 ? (
              <p className="text-[11px] text-amber-400/80 flex items-center gap-1 font-medium">
                <Info size={11} /> No snooze option will be offered when this alarm goes off.
              </p>
            ) : null}
          </div>

          {/* Save / Cancel Action Bar */}
          <div id="form-actions" className="flex items-center gap-4 pt-6 border-t border-zinc-800/40">
            <button
              id="cancel-form-action-btn"
              type="button"
              onClick={() => {
                stopAlarmSound();
                onCancel();
              }}
              className="flex-1 py-3 px-4 rounded-full text-xs font-bold uppercase tracking-widest border border-zinc-800 bg-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-850/50 transition-all"
            >
              Cancel
            </button>
            <button
              id="save-form-action-btn"
              type="submit"
              className="flex-1 py-3 px-4 rounded-full text-xs font-bold uppercase tracking-widest bg-white text-black hover:bg-zinc-200 transition-all focus:outline-none"
            >
              Save Alarm
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
