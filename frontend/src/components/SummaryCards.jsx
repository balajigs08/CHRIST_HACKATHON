import { SEVERITY } from '../types/constants.js'

const CARDS = [
  { key: 'critical', label: 'Critical',  icon: '🔴', color: '#ef4444', glow: 'rgba(239,68,68,0.2)' },
  { key: 'high',     label: 'High',      icon: '🟠', color: '#f97316', glow: 'rgba(249,115,22,0.2)' },
  { key: 'medium',   label: 'Medium',    icon: '🟡', color: '#eab308', glow: 'rgba(234,179,8,0.2)' },
  { key: 'low',      label: 'Low',       icon: '🔵', color: '#38bdf8', glow: 'rgba(56,189,248,0.2)' },
  { key: 'waiting',  label: 'Waiting',   icon: '⏳', color: '#a78bfa', glow: 'rgba(167,139,250,0.2)' },
]

export default function SummaryCards({ summary = {}, resources = [] }) {
  const available  = resources.filter(r => r.status === 'available').length
  const assigned   = resources.filter(r => r.status === 'assigned').length
  const unavail    = resources.filter(r => r.status === 'unavailable' || r.status === 'maintenance').length

  return (
    <div className="space-y-3">
      {/* Incident severity cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {CARDS.map(c => {
          const val = summary[c.key] ?? 0
          const isAlert = val > 0 && (c.key === 'critical' || c.key === 'waiting')
          return (
            <div
              key={c.key}
              className="stat-card"
              style={{ '--accent-color': c.color, boxShadow: val > 0 ? `0 4px 24px ${c.glow}` : undefined }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{c.label}</p>
                  <p
                    className={`mt-1 text-4xl font-black leading-none ${isAlert && val > 0 ? 'animate-flash' : ''}`}
                    style={{ color: val > 0 ? c.color : '#334155' }}
                  >
                    {val}
                  </p>
                </div>
                <span className="text-2xl opacity-70">{c.icon}</span>
              </div>
              <p className="mt-2 text-[10px] text-slate-600">incidents</p>
            </div>
          )
        })}
      </div>

      {/* Resource status bar */}
      <div className="flex items-center gap-3 rounded-xl border border-edge bg-panel/60 px-4 py-2.5">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Resources</span>
        <div className="flex flex-1 gap-4 text-xs">
          <ResourcePill label="Available" count={available} color="text-green-400" dot="bg-green-400" />
          <ResourcePill label="Assigned"  count={assigned}  color="text-blue-400"  dot="bg-blue-400" />
          <ResourcePill label="Offline"   count={unavail}   color="text-red-400"   dot="bg-red-400" />
        </div>
        {/* Inline bar chart */}
        <div className="hidden sm:flex h-2 w-32 overflow-hidden rounded-full bg-edge">
          {available > 0 && (
            <div className="h-full bg-green-500 transition-all"
              style={{ width: `${(available / resources.length) * 100}%` }} />
          )}
          {assigned > 0 && (
            <div className="h-full bg-blue-500 transition-all"
              style={{ width: `${(assigned / resources.length) * 100}%` }} />
          )}
          {unavail > 0 && (
            <div className="h-full bg-red-500 transition-all"
              style={{ width: `${(unavail / resources.length) * 100}%` }} />
          )}
        </div>
        <span className="text-[10px] text-slate-600 font-mono">{resources.length} total</span>
      </div>
    </div>
  )
}

function ResourcePill({ label, count, color, dot }) {
  return (
    <span className="flex items-center gap-1.5 font-medium">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      <span className={`${color} font-bold`}>{count}</span>
      <span className="text-slate-500">{label}</span>
    </span>
  )
}
