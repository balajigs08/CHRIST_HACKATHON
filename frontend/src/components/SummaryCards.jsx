import { SEVERITY } from '../types/constants.js'

const CARDS = [
  { key: 'critical', label: 'Critical',  icon: '🔴', color: '#dc2626', glow: 'rgba(220,38,38,0.08)' },
  { key: 'high',     label: 'High',      icon: '🟠', color: '#ea580c', glow: 'rgba(234,88,12,0.08)' },
  { key: 'medium',   label: 'Medium',    icon: '🟡', color: '#ca8a04', glow: 'rgba(202,138,4,0.08)' },
  { key: 'low',      label: 'Low',       icon: '🔵', color: '#0284c7', glow: 'rgba(2,132,199,0.08)' },
  { key: 'waiting',  label: 'Waiting',   icon: '⏳', color: '#7c3aed', glow: 'rgba(124,58,237,0.08)' },
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
              style={{ '--accent-color': c.color, boxShadow: val > 0 ? `0 2px 12px ${c.glow}` : undefined }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{c.label}</p>
                  <p
                    className={`mt-1 text-3xl font-extrabold leading-none ${isAlert && val > 0 ? 'animate-flash' : ''}`}
                    style={{ color: val > 0 ? c.color : '#94a3b8' }}
                  >
                    {val}
                  </p>
                </div>
                <span className="text-2xl">{c.icon}</span>
              </div>
              <p className="mt-2 text-[11px] text-slate-500 font-medium">incidents</p>
            </div>
          )
        })}
      </div>

      {/* Resource status bar */}
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-2xs">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Resources</span>
        <div className="flex flex-1 gap-4 text-xs">
          <ResourcePill label="Available" count={available} color="text-emerald-700" dot="bg-emerald-500" />
          <ResourcePill label="Assigned"  count={assigned}  color="text-blue-700"  dot="bg-blue-500" />
          <ResourcePill label="Offline"   count={unavail}   color="text-red-700"   dot="bg-red-500" />
        </div>
        {/* Inline bar chart */}
        <div className="hidden sm:flex h-2 w-32 overflow-hidden rounded-full bg-slate-100 border border-slate-200">
          {available > 0 && (
            <div className="h-full bg-emerald-500 transition-all"
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
        <span className="text-[10px] text-slate-500 font-mono font-medium">{resources.length} total</span>
      </div>
    </div>
  )
}

function ResourcePill({ label, count, color, dot }) {
  return (
    <span className="flex items-center gap-1.5 font-medium">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      <span className={`${color} font-bold`}>{count}</span>
      <span className="text-slate-600">{label}</span>
    </span>
  )
}
