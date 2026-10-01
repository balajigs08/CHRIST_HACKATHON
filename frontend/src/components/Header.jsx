import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
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
  const { logout } = useAuth()
  const [now, setNow] = useState(new Date().toISOString())

  // Tick real clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date().toISOString()), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-3 bg-white shadow-sm"
    >
      {/* ── Brand ── */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl text-lg font-black"
          style={{ background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', boxShadow: '0 2px 10px rgba(14,165,233,0.25)' }}
        >
          ⚡
        </div>
        <div>
          <h1 className="text-sm font-black tracking-[0.2em] text-slate-900 leading-none">CRISIS COMMAND</h1>
          <p className="text-[10px] uppercase tracking-widest text-slate-400 leading-none mt-0.5">
            Domain 4 · Public Safety & Emergency Response
          </p>
        </div>
      </div>

      {/* ── Center: Real-Time Connection Status + Clock ── */}
      <div className="hidden md:flex items-center gap-2.5 text-[11px] font-mono">
        <RealtimeStatusBadge
          status={realtimeStatus}
          onStatusChange={onRealtimeStatusChange}
          lastUpdateTime={lastUpdateTime}
          onTriggerEvent={onTriggerEvent}
          autoStreamActive={autoStreamActive}
          onToggleAutoStream={onToggleAutoStream}
        />

        {/* Clock */}
        <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
          <span className="text-slate-400">🕐</span>
          <span className="text-slate-700 font-semibold">{fmtTime(simTime || now)}</span>
          {simTime && <span className="text-slate-400 text-[9px] ml-1">SIM</span>}
        </div>
      </div>

      {/* ── Right actions ── */}
      <div className="flex items-center gap-2">
        {/* Mobile clock */}
        <span className="md:hidden mono text-xs text-slate-400">{fmtTime(now)}</span>

        {/* Notification bell */}
        <button
          id="header-notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white transition-all hover:border-slate-300 hover:bg-slate-50"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          {pendingApprovals > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white animate-flash">
              {pendingApprovals}
            </span>
          )}
        </button>

        {/* Authority Profile / Logout */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="hidden lg:flex flex-col text-right">
            <span className="text-[11px] font-bold text-amber-600">Command Authority</span>
            <span className="text-[9px] text-slate-400 font-mono">Operations Lead</span>
          </div>
          <button
            id="header-logout-btn"
            onClick={logout}
            className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 hover:border-red-300 transition-all flex items-center gap-1.5"
            title="Sign out of Authority Console"
          >
            <span>🚪</span>
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  )
}
