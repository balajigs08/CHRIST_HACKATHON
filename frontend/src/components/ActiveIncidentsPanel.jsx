import { useState } from 'react'
import { MOCK_INCIDENTS } from '../data/mockData.js'
import { SEVERITY, INCIDENT_ICON, pretty, fmtTime, timeSince } from '../types/constants.js'

const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 }

export default function ActiveIncidentsPanel({ incidents: propIncidents }) {
  const [filter, setFilter]   = useState('all')
  const [expanded, setExpanded] = useState(null)

  const incidentList = propIncidents || MOCK_INCIDENTS
  const active   = incidentList.filter(i => i.status !== 'resolved')
  const filtered = filter === 'all' ? active : active.filter(i => i.severity === filter)
  const sorted   = [...filtered].sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9))

  return (
    <div className="panel flex flex-col">
      {/* Header */}
      <div className="panel-title flex-wrap gap-2">
        <span className="text-orange-400">⚠</span>
        <span>Active Incidents</span>
        <span className="mono rounded-full bg-edge px-2 py-0.5 text-[10px] text-slate-400">{active.length}</span>
        <div className="ml-auto flex flex-wrap gap-1 normal-case">
          {['all', 'critical', 'high', 'medium'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold capitalize transition-all ${
                filter === f
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  : 'text-slate-600 hover:text-slate-400'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="divide-y divide-edge/50">
        {sorted.map(inc => {
          const sev     = SEVERITY[inc.severity] || SEVERITY.medium
          const isOpen  = expanded === inc.id
          const isCrit  = inc.severity === 'critical'
          const isWaiting = inc.status === 'waiting'
          const icon    = INCIDENT_ICON[inc.type] || INCIDENT_ICON.default

          return (
            <div key={inc.id} className={`transition-colors ${isCrit ? 'bg-red-500/3' : ''}`}>
              <button
                className="w-full px-4 py-3 text-left hover:bg-panel2/50 transition-colors"
                onClick={() => setExpanded(isOpen ? null : inc.id)}
              >
                <div className="flex items-start gap-3">
                  {/* Severity indicator + icon */}
                  <div className="flex-shrink-0 flex flex-col items-center gap-1 mt-0.5">
                    <span
                      className={`h-2 w-2 rounded-full flex-shrink-0 ${isCrit ? 'animate-flash' : ''}`}
                      style={{ background: sev.color, boxShadow: isCrit ? `0 0 8px ${sev.color}` : undefined }}
                    />
                  </div>

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="mono text-xs font-bold text-slate-300">{inc.id}</span>
                      <span className="text-[10px]">{icon}</span>
                      <span className="text-xs text-slate-400">{pretty(inc.type)}</span>
                      <span
                        className="badge"
                        style={{ color: sev.color, borderColor: `${sev.color}40`, background: `${sev.color}12` }}
                      >
                        {sev.label}
                      </span>
                      {isWaiting && (
                        <span
                          className="badge animate-flash"
                          style={{ color: '#c4b5fd', borderColor: 'rgba(167,139,250,0.4)', background: 'rgba(167,139,250,0.1)' }}
                        >
                          ⏳ Waiting
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-400 leading-relaxed truncate">
                      {inc.description}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-slate-600">
                      <span>📍 {inc.location_name}</span>
                      <span>⏱ {timeSince(inc.created_at)}</span>
                      <span>🕐 waiting {Math.round(inc.waiting_time)}m</span>
                      <span>urgency {inc.urgency}/10</span>
                    </div>
                  </div>

                  {/* Expand arrow */}
                  <span className={`text-slate-600 text-xs flex-shrink-0 mt-1 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                    ▾
                  </span>
                </div>
              </button>

              {/* Expanded detail */}
              {isOpen && (
                <div className="border-t border-edge/40 bg-panel2/40 px-4 py-3 slide-up">
                  <div className="grid gap-3 sm:grid-cols-2 text-xs">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-1">Required Resources</p>
                      <div className="flex flex-wrap gap-1.5">
                        {inc.required_resources.map(r => {
                          const missing = inc.missing_resources.includes(r)
                          return (
                            <span key={r} className="badge"
                              style={missing
                                ? { color: '#fca5a5', borderColor: 'rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.1)' }
                                : { color: '#86efac', borderColor: 'rgba(34,197,94,0.35)', background: 'rgba(34,197,94,0.08)' }
                              }
                            >
                              {missing ? '✗ ' : '✓ '}{pretty(r)}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-1">Assigned Units</p>
                      <div className="flex flex-wrap gap-1.5">
                        {inc.assigned_resources.length > 0
                          ? inc.assigned_resources.map(r => (
                            <span key={r} className="mono text-[11px] font-bold text-sky-300 bg-sky-500/10 border border-sky-500/25 rounded-md px-2 py-0.5">{r}</span>
                          ))
                          : <span className="text-slate-600">None assigned</span>
                        }
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-1">Coordinates</p>
                      <p className="mono text-slate-500">{inc.latitude.toFixed(4)}, {inc.longitude.toFixed(4)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
