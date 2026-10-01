import { useState, useEffect, useRef } from 'react'
import { fmtTime, timeSince } from '../types/constants.js'

/**
 * Reusable Real-time Connection Status & Live Updates Indicator (Phase 11)
 *
 * Displays:
 *  - Connected (green)
 *  - Connecting (amber spinner)
 *  - Disconnected (slate/red)
 *  - Reconnecting (orange pulse)
 *  - "Live Updates" indicator showing latest update timestamp
 *
 * Clickable to open a tactical control menu for testing states & mock events.
 */
export default function RealtimeStatusBadge({
  status = 'connected',
  onStatusChange,
  lastUpdateTime,
  onTriggerEvent,
  autoStreamActive = false,
  onToggleAutoStream,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const popoverRef = useRef(null)

  // Update time elapsed since last update
  useEffect(() => {
    const updateElapsed = () => {
      if (!lastUpdateTime) {
        setElapsedSeconds(0)
        return
      }
      const diff = Math.floor((Date.now() - new Date(lastUpdateTime).getTime()) / 1000)
      setElapsedSeconds(Math.max(0, diff))
    }

    updateElapsed()
    const timer = setInterval(updateElapsed, 1000)
    return () => clearInterval(timer)
  }, [lastUpdateTime])

  // Click outside to close popover
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Status visual styles
  const STATUS_CONFIG = {
    connected: {
      label: 'Connected',
      dotClass: 'bg-emerald-500 animate-pulse',
      borderClass: 'border-emerald-300 bg-emerald-50 text-emerald-700',
      pingClass: 'bg-emerald-500',
      glow: 'none',
      icon: '●',
    },
    connecting: {
      label: 'Connecting...',
      dotClass: 'bg-amber-500 animate-spin',
      borderClass: 'border-amber-300 bg-amber-50 text-amber-700',
      pingClass: 'bg-amber-500',
      glow: 'none',
      icon: '◌',
    },
    reconnecting: {
      label: 'Reconnecting...',
      dotClass: 'bg-orange-500 animate-ping',
      borderClass: 'border-orange-300 bg-orange-50 text-orange-700',
      pingClass: 'bg-orange-500',
      glow: 'none',
      icon: '⟳',
    },
    disconnected: {
      label: 'Disconnected',
      dotClass: 'bg-rose-500',
      borderClass: 'border-rose-300 bg-rose-50 text-rose-700',
      pingClass: 'bg-rose-500',
      glow: 'none',
      icon: '✕',
    },
  }

  const currentCfg = STATUS_CONFIG[status] || STATUS_CONFIG.connected

  return (
    <div className="relative inline-block" ref={popoverRef}>
      {/* ── Main Badge Container ── */}
      <div className="flex items-center gap-2">
        {/* Connection Status Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-mono font-bold transition-all hover:brightness-110 ${currentCfg.borderClass}`}
          style={{ boxShadow: currentCfg.glow }}
          title="Click to toggle connection state or trigger mock events"
        >
          <span className={`h-2 w-2 rounded-full ${currentCfg.dotClass}`} />
          <span className="uppercase tracking-wider">{currentCfg.label}</span>
          <span className="text-[10px] opacity-60">▼</span>
        </button>

        {/* Live Updates Indicator (Requirement 8) */}
        <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-mono text-slate-500">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
          <span className="font-semibold text-slate-700">LIVE</span>
          <span className="text-slate-300">·</span>
          <span>
            {elapsedSeconds === 0 ? 'just now' : `${elapsedSeconds}s ago`}
          </span>
        </div>
      </div>

      {/* ── Interactive Dropdown Menu for Controls ── */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              ⚡ Real-time Telemetry Menu
            </span>
            <span className="text-[10px] font-mono text-slate-400">Phase 11</span>
          </div>

          {/* 1. Connection State Switcher */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Simulate Connection Status:
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {['connected', 'connecting', 'reconnecting', 'disconnected'].map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    if (onStatusChange) onStatusChange(s)
                    setIsOpen(false)
                  }}
                  className={`rounded-lg px-2.5 py-1 text-xs font-mono text-left capitalize transition-all ${
                    status === s
                      ? 'bg-sky-100 text-sky-700 border border-sky-300 font-bold'
                      : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Manual Mock Event Trigger */}
          <div className="space-y-1.5 pt-1 border-t border-slate-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Inject Mock Real-time Event:
            </div>
            <button
              onClick={() => {
                if (onTriggerEvent) onTriggerEvent()
              }}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold px-3 py-2 text-xs shadow-md shadow-sky-950/30 transition-all"
            >
              <span>⚡ Trigger Next Live Event</span>
            </button>
          </div>

          {/* 3. Auto-Stream Toggle */}
          <div className="pt-1 border-t border-slate-200">
            <button
              onClick={() => {
                if (onToggleAutoStream) onToggleAutoStream()
              }}
              className={`w-full flex items-center justify-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
                autoStreamActive
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-900'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${autoStreamActive ? 'bg-emerald-500 animate-ping' : 'bg-slate-300'}`} />
              <span>
                {autoStreamActive ? 'Auto-Stream ON (Every 8s)' : 'Enable Auto-Stream'}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
