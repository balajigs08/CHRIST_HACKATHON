import { useState } from 'react'
import { pretty } from '../types/constants.js'

const STATUS_STYLE = {
  assigned: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)' },
  waiting:  { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.3)' },
  resolved: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.3)' },
}

export default function PlanTable({ plan }) {
  const [view, setView] = useState('table') // table | cards
  const assignments       = plan?.assignments || []
  const unassigned        = plan?.unassigned_incidents || []
  const hasUnassigned     = unassigned.length > 0

  return (
    <div className="panel">
      {/* Header */}
      <div className="panel-title flex-wrap gap-2">
        <span className="text-violet-400">📋</span>
        <span>
          Response Plan
          {plan?.plan_id && plan.plan_id !== 'PLN000' && (
            <span className="ml-2 mono text-slate-500 normal-case font-normal">· {plan.plan_id}</span>
          )}
        </span>
        {plan?.optimization_status && plan.optimization_status !== 'NotRun' && (
          <span className="ml-2 mono text-[10px] font-normal text-slate-600 normal-case">
            CBC: <span className="text-green-400">{plan.optimization_status}</span>
            {plan.objective_value != null && ` · obj ${plan.objective_value.toFixed(1)}`}
          </span>
        )}
        <div className="ml-auto flex gap-1 normal-case">
          <button onClick={() => setView('table')}
            className={`rounded px-2 py-0.5 text-[10px] ${view === 'table' ? 'bg-sky-500/20 text-sky-300' : 'text-slate-500 hover:text-slate-300'}`}>
            Table
          </button>
          <button onClick={() => setView('cards')}
            className={`rounded px-2 py-0.5 text-[10px] ${view === 'cards' ? 'bg-sky-500/20 text-sky-300' : 'text-slate-500 hover:text-slate-300'}`}>
            Cards
          </button>
        </div>
      </div>

      {/* Plan explanation */}
      {plan?.explanation && (
        <div className="border-b border-edge bg-panel2/50 px-4 py-3 text-xs text-slate-400 italic">
          {plan.explanation}
        </div>
      )}

      {/* Alerts for unassigned */}
      {hasUnassigned && (
        <div className="border-b border-red-500/20 bg-red-500/5 px-4 py-2.5 flex items-start gap-2">
          <span className="text-red-400 text-sm mt-0.5 animate-flash">⚠</span>
          <div className="text-xs">
            <p className="font-semibold text-red-300">
              {unassigned.length} incident{unassigned.length > 1 ? 's' : ''} cannot be fully covered
            </p>
            <p className="text-red-400/70 mt-0.5">
              {unassigned.map(u => `${u.incident_id}: missing ${u.missing_resources.map(pretty).join(', ')}`).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      {view === 'table' ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th>Incident</th>
                <th>Resource</th>
                <th>Distance</th>
                <th>ETA</th>
                <th>Status</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {assignments.length === 0 && unassigned.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-6 text-center text-slate-600">No assignments yet.</td>
                </tr>
              )}
              {assignments.map(x => {
                const st = STATUS_STYLE[x.status] || STATUS_STYLE.assigned
                return (
                  <tr key={x.id}>
                    <td className="mono font-bold text-slate-200">{x.incident_id}</td>
                    <td>
                      <span className="mono font-bold text-slate-200">{x.resource_id}</span>
                      <span className="ml-1.5 text-xs text-slate-500">{pretty(x.resource_type)}</span>
                    </td>
                    <td className="mono text-slate-400">{x.distance} km</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <span className="text-green-400 text-xs">⟳</span>
                        <span className="mono text-slate-300">{x.eta} min</span>
                      </div>
                    </td>
                    <td>
                      <span className="badge" style={{ color: st.color, borderColor: st.border, background: st.bg }}>
                        {x.status}
                      </span>
                    </td>
                    <td className="max-w-xs text-xs text-slate-500">{x.reason}</td>
                  </tr>
                )
              })}
              {unassigned.map(u => (
                <tr key={u.incident_id} className="bg-red-500/5">
                  <td className="mono font-bold text-red-300">{u.incident_id}</td>
                  <td colSpan="3" className="text-xs text-red-400">
                    ✗ UNASSIGNED — missing: {u.missing_resources.map(pretty).join(', ')}
                  </td>
                  <td>
                    <span className="badge animate-flash" style={{
                      color: '#fca5a5', borderColor: 'rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.1)'
                    }}>waiting</span>
                  </td>
                  <td className="text-xs text-slate-600">{u.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {assignments.map(x => (
            <AssignmentCard key={x.id} x={x} />
          ))}
          {unassigned.map(u => (
            <UnassignedCard key={u.incident_id} u={u} />
          ))}
          {assignments.length === 0 && unassigned.length === 0 && (
            <p className="col-span-full text-center text-slate-600 py-6">No assignments yet.</p>
          )}
        </div>
      )}
    </div>
  )
}

function AssignmentCard({ x }) {
  return (
    <div className="rounded-xl border border-edge bg-panel2/60 p-3 transition-all hover:border-edge2">
      <div className="flex items-start justify-between">
        <div>
          <p className="mono text-sm font-bold text-slate-200">{x.incident_id}</p>
          <p className="text-xs text-slate-500 mt-0.5">← {x.resource_id} · {pretty(x.resource_type)}</p>
        </div>
        <span className="badge" style={{
          color: STATUS_STYLE[x.status]?.color || '#3b82f6',
          borderColor: STATUS_STYLE[x.status]?.border || 'rgba(59,130,246,0.3)',
          background: STATUS_STYLE[x.status]?.bg || 'rgba(59,130,246,0.1)',
        }}>{x.status}</span>
      </div>
      <div className="mt-2 flex gap-3 text-xs text-slate-400">
        <span>📍 {x.distance} km</span>
        <span>⏱ {x.eta} min ETA</span>
      </div>
      {x.reason && <p className="mt-2 text-[11px] text-slate-600 border-t border-edge pt-2">{x.reason}</p>}
    </div>
  )
}

function UnassignedCard({ u }) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3">
      <div className="flex items-center gap-2">
        <span className="animate-flash text-red-400">⚠</span>
        <p className="mono text-sm font-bold text-red-300">{u.incident_id}</p>
      </div>
      <p className="mt-1 text-xs text-red-400/80">Missing: {(u.missing_resources || []).map(pretty).join(', ')}</p>
      {u.reason && <p className="mt-1 text-[11px] text-red-400/50">{u.reason}</p>}
    </div>
  )
}
