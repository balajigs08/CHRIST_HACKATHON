import { useState } from 'react'
import { pretty } from '../types/constants.js'

const STATUS_STYLE = {
  assigned: { color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  waiting:  { color: '#6d28d9', bg: '#f5f3ff', border: '#ddd6fe' },
  resolved: { color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
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
        <span className="text-violet-600">📋</span>
        <span>
          Response Plan
          {plan?.plan_id && plan.plan_id !== 'PLN000' && (
            <span className="ml-2 mono text-slate-500 normal-case font-normal">· {plan.plan_id}</span>
          )}
        </span>
        {plan?.optimization_status && plan.optimization_status !== 'NotRun' && (
          <span className="ml-2 mono text-[10px] font-normal text-slate-500 normal-case">
            CBC: <span className="text-emerald-600 font-semibold">{plan.optimization_status}</span>
            {plan.objective_value != null && ` · obj ${plan.objective_value.toFixed(1)}`}
          </span>
        )}
        <div className="ml-auto flex gap-1 normal-case">
          <button onClick={() => setView('table')}
            className={`rounded px-2.5 py-0.5 text-[10px] font-semibold transition-colors ${view === 'table' ? 'bg-sky-100 text-sky-700 border border-sky-300' : 'text-slate-500 hover:text-slate-800'}`}>
            Table
          </button>
          <button onClick={() => setView('cards')}
            className={`rounded px-2.5 py-0.5 text-[10px] font-semibold transition-colors ${view === 'cards' ? 'bg-sky-100 text-sky-700 border border-sky-300' : 'text-slate-500 hover:text-slate-800'}`}>
            Cards
          </button>
        </div>
      </div>

      {/* Plan explanation */}
      {plan?.explanation && (
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 italic">
          {plan.explanation}
        </div>
      )}

      {/* Alerts for unassigned */}
      {hasUnassigned && (
        <div className="border-b border-red-200 bg-red-50/70 px-4 py-2.5 flex items-start gap-2">
          <span className="text-red-600 text-sm mt-0.5 font-bold">⚠</span>
          <div className="text-xs">
            <p className="font-semibold text-red-800">
              {unassigned.length} incident{unassigned.length > 1 ? 's' : ''} cannot be fully covered
            </p>
            <p className="text-red-700/80 mt-0.5">
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
                  <td colSpan="6" className="py-6 text-center text-slate-500">No assignments yet.</td>
                </tr>
              )}
              {assignments.map(x => {
                const st = STATUS_STYLE[x.status] || STATUS_STYLE.assigned
                return (
                  <tr key={x.id}>
                    <td className="mono font-bold text-slate-800">{x.incident_id}</td>
                    <td>
                      <span className="mono font-bold text-slate-800">{x.resource_id}</span>
                      <span className="ml-1.5 text-xs text-slate-500">{pretty(x.resource_type)}</span>
                    </td>
                    <td className="mono text-slate-600">{x.distance} km</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <span className="text-emerald-600 text-xs">⟳</span>
                        <span className="mono text-slate-700 font-semibold">{x.eta} min</span>
                      </div>
                    </td>
                    <td>
                      <span className="badge font-medium" style={{ color: st.color, borderColor: st.border, background: st.bg }}>
                        {x.status}
                      </span>
                    </td>
                    <td className="max-w-xs text-xs text-slate-500">{x.reason}</td>
                  </tr>
                )
              })}
              {unassigned.map(u => (
                <tr key={u.incident_id} className="bg-red-50/50">
                  <td className="mono font-bold text-red-700">{u.incident_id}</td>
                  <td colSpan="3" className="text-xs text-red-700 font-medium">
                    ✗ UNASSIGNED — missing: {u.missing_resources.map(pretty).join(', ')}
                  </td>
                  <td>
                    <span className="badge font-medium" style={{
                      color: '#b91c1c', borderColor: 'rgba(239,68,68,0.4)', background: 'rgba(254,242,242,1)'
                    }}>waiting</span>
                  </td>
                  <td className="text-xs text-slate-500">{u.reason}</td>
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
            <p className="col-span-full text-center text-slate-500 py-6">No assignments yet.</p>
          )}
        </div>
      )}
    </div>
  )
}

function AssignmentCard({ x }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs transition-all hover:border-slate-300">
      <div className="flex items-start justify-between">
        <div>
          <p className="mono text-sm font-bold text-slate-800">{x.incident_id}</p>
          <p className="text-xs text-slate-500 mt-0.5">← {x.resource_id} · {pretty(x.resource_type)}</p>
        </div>
        <span className="badge font-medium" style={{
          color: STATUS_STYLE[x.status]?.color || '#1d4ed8',
          borderColor: STATUS_STYLE[x.status]?.border || '#bfdbfe',
          background: STATUS_STYLE[x.status]?.bg || '#eff6ff',
        }}>{x.status}</span>
      </div>
      <div className="mt-2 flex gap-3 text-xs text-slate-600 font-mono">
        <span>📍 {x.distance} km</span>
        <span>⏱ {x.eta} min ETA</span>
      </div>
      {x.reason && <p className="mt-2 text-[11px] text-slate-500 border-t border-slate-100 pt-2">{x.reason}</p>}
    </div>
  )
}

function UnassignedCard({ u }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50/60 p-3.5 shadow-2xs">
      <div className="flex items-center gap-2">
        <span className="text-red-600 font-bold">⚠</span>
        <p className="mono text-sm font-bold text-red-800">{u.incident_id}</p>
      </div>
      <p className="mt-1 text-xs text-red-700 font-medium">Missing: {(u.missing_resources || []).map(pretty).join(', ')}</p>
      {u.reason && <p className="mt-1 text-[11px] text-red-600/80">{u.reason}</p>}
    </div>
  )
}
