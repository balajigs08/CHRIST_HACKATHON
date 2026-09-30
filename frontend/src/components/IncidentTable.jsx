import { useState } from 'react'
import { SEVERITY, pretty, fmtTime } from '../types/constants.js'

const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 }

export default function IncidentTable({ incidents = [], onResolve, busy }) {
  const [sortBy, setSortBy] = useState('severity')
  const [filter, setFilter] = useState('all')
  const [hoverId, setHoverId] = useState(null)

  const active = incidents.filter(i => i.status !== 'resolved')
  const filtered = filter === 'all' ? active : active.filter(i => i.severity === filter)
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'severity') return (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9)
    if (sortBy === 'waiting')  return b.waiting_time - a.waiting_time
    if (sortBy === 'urgency')  return b.urgency - a.urgency
    return 0
  })

  return (
    <div className="panel">
      {/* Header */}
      <div className="panel-title flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-orange-400">⚠</span>
          <span>Active Incidents</span>
          <span className="mono rounded-full bg-edge px-2 py-0.5 text-[10px] text-slate-400">
            {active.length}
          </span>
        </div>
        {/* Filters */}
        <div className="flex gap-1 ml-auto normal-case">
          {['all', 'critical', 'high', 'medium', 'low'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-all capitalize ${
                filter === f
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        {/* Sort */}
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className="ml-2 rounded border border-edge bg-panel px-2 py-0.5 text-[10px] text-slate-400 outline-none normal-case"
        >
          <option value="severity">Sort: Severity</option>
          <option value="waiting">Sort: Waiting</option>
          <option value="urgency">Sort: Urgency</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th>ID</th>
              <th>Type</th>
              <th>Severity</th>
              <th>Urgency</th>
              <th>Location</th>
              <th>Required</th>
              <th>Status</th>
              <th>Waiting</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan="9" className="py-8 text-center text-slate-600">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-2xl">✅</span>
                    <span>No active incidents</span>
                  </div>
                </td>
              </tr>
            )}
            {sorted.map(i => {
              const sev = SEVERITY[i.severity] || SEVERITY.low
              const isCritical = i.severity === 'critical'
              const isWaiting  = i.status === 'waiting'
              return (
                <tr
                  key={i.id}
                  onMouseEnter={() => setHoverId(i.id)}
                  onMouseLeave={() => setHoverId(null)}
                  className={isCritical ? 'bg-red-500/5' : ''}
                >
                  <td>
                    <div className="flex items-center gap-2">
                      {isCritical && (
                        <span className="animate-flash text-red-400 text-[10px]">●</span>
                      )}
                      <span className="mono font-bold text-slate-200">{i.id}</span>
                    </div>
                  </td>
                  <td>
                    <span className="text-slate-300" title={i.description}>
                      {pretty(i.type)}
                    </span>
                    {i.description && (
                      <p className="text-[11px] text-slate-600 max-w-[160px] truncate"
                        title={i.description}>{i.description}</p>
                    )}
                  </td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        color: sev.color,
                        borderColor: `${sev.color}40`,
                        background: `${sev.color}15`,
                      }}
                    >
                      {sev.label}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-edge">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${i.urgency * 10}%`,
                            background: i.urgency >= 8 ? '#ef4444' : i.urgency >= 5 ? '#f97316' : '#38bdf8',
                          }}
                        />
                      </div>
                      <span className="mono text-xs text-slate-400">{i.urgency}/10</span>
                    </div>
                  </td>
                  <td className="text-xs text-slate-400">
                    {i.location_name || `${i.latitude?.toFixed(3)}, ${i.longitude?.toFixed(3)}`}
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {(i.required_resources || []).map(r => {
                        const missing = (i.missing_resources || []).includes(r)
                        return (
                          <span
                            key={r}
                            className="badge"
                            style={missing ? {
                              color: '#fca5a5',
                              borderColor: 'rgba(239,68,68,0.4)',
                              background: 'rgba(239,68,68,0.12)',
                            } : {
                              color: '#94a3b8',
                              borderColor: 'rgba(100,116,139,0.3)',
                              background: 'rgba(100,116,139,0.08)',
                            }}
                          >
                            {missing && '✗ '}{pretty(r)}
                          </span>
                        )
                      })}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${isWaiting ? 'animate-flash' : ''}`}
                      style={isWaiting ? {
                        color: '#c4b5fd',
                        borderColor: 'rgba(167,139,250,0.4)',
                        background: 'rgba(167,139,250,0.12)',
                      } : {
                        color: '#86efac',
                        borderColor: 'rgba(34,197,94,0.3)',
                        background: 'rgba(34,197,94,0.08)',
                      }}
                    >
                      {i.status}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <span className="mono text-xs text-slate-400">{Math.round(i.waiting_time)}m</span>
                      {i.waiting_time > 20 && <span className="text-amber-400 text-[10px]">↑</span>}
                    </div>
                  </td>
                  <td>
                    <button
                      disabled={busy}
                      onClick={() => onResolve(i.id)}
                      className="btn text-[11px] px-2.5 py-1"
                    >
                      ✓ Resolve
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
