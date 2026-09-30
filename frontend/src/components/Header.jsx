import { useState, useEffect } from 'react'
import { fmtTime } from '../types/constants.js'
import RealtimeStatusBadge from './RealtimeStatusBadge.jsx'

export default function Header({
  simTime,
  connected = false,
  backendUp = false,
  pendingApprovals = 0,
  realtimeStatus = 'connected',
  onRealtimeStatusChange,
  lastUpdateTime,
  onTriggerEvent,
  autoStreamActive = false,
  onToggleAutoStream,
}) {
  const [now, setNow] = useState(new Date().toISOString())

  // Tick real clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date().toISOString()), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-edge px-5 py-3"
      style={{ background: 'rgba(11,21,37,0.97)', backdropFilter: 'blur(16px)' }}
    >
      {/* ── Brand ── */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl text-lg font-black"
          style={{ background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', boxShadow: '0 0 16px rgba(14,165,233,0.35)' }}
        >
          ⚡
        </div>
        <div>
          <h1 className="text-sm font-black tracking-[0.2em] text-white leading-none">CRISIS COMMAND</h1>
          <p className="text-[10px] uppercase tracking-widest text-slate-600 leading-none mt-0.5">
            Domain 4 · Public Safety & Emergency Response
          </p>
        </div>
      </div>

      {/* ── Center: Real-Time Connection Status + Clock (Phase 11) ── */}
      <div className="hidden md:flex items-center gap-2.5 text-[11px] font-mono">
        {/* Reusable Real-time Status & Live Updates Indicator */}
        <RealtimeStatusBadge
          status={realtimeStatus}
          onStatusChange={onRealtimeStatusChange}
          lastUpdateTime={lastUpdateTime}
          onTriggerEvent={onTriggerEvent}
          autoStreamActive={autoStreamActive}
          onToggleAutoStream={onToggleAutoStream}
        />

        {/* Clock */}
        <div className="flex items-center gap-1.5 rounded-full border border-edge bg-panel/60 px-3 py-1.5">
          <span className="text-slate-600">🕐</span>
          <span className="text-slate-300 font-semibold">{fmtTime(simTime || now)}</span>
          {simTime && <span className="text-slate-600 text-[9px] ml-1">SIM</span>}
        </div>
      </div>

      {/* ── Right actions ── */}
      <div className="flex items-center gap-2">
        {/* Mobile clock */}
        <span className="md:hidden mono text-xs text-slate-500">{fmtTime(now)}</span>

        {/* Notification bell */}
        <button
          id="header-notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-edge bg-panel/60 transition-all hover:border-edge2 hover:bg-panel2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          {pendingApprovals > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white animate-flash">
              {pendingApprovals}
            </span>
          )}
        </button>

        {/* Settings */}
        <button
          id="header-settings"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-edge bg-panel/60 transition-all hover:border-edge2 hover:bg-panel2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>

        {/* Profile avatar */}
        <button
          id="header-profile"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-500/30 font-bold text-sm text-sky-300 transition-all hover:border-sky-400/50"
          style={{ background: 'rgba(14,165,233,0.08)' }}
        >
          CC
        </button>
      </div>
    </header>
  )
}
