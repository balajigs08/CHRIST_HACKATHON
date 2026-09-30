import { useState } from 'react'
import { fmtTime, pretty } from '../types/constants.js'

const fmt = (list) =>
  list?.length ? list.map(p => `${p.incident_id} → ${p.resource_id}`) : ['(no assignments)']

export default function PlanChangePanel({ history = [] }) {
  const [sel, setSel] = useState(null)
  const shown = history.filter(h => h.changes?.length > 0 || history.length === 1)
  const list  = shown.length ? shown : history
  const entry = list.find(h => h.plan_id === sel) || list[list.length - 1]

  if (!entry && list.length === 0) {
    return (
      <div className="panel">
        <div className="panel-title"><span className="text-purple-400">🔄</span> Plan Change History</div>
        <div className="px-4 py-8 text-center text-slate-600">
          <div className="text-2xl mb-2">📋</div>
          <p className="text-sm">No plan changes yet</p>
          <p className="text-xs mt-1 text-slate-700">Plan diff will appear when the optimizer runs</p>
        </div>
      </div>
    )
  }

  return (
    <div className="panel">
      {/* Header */}
      <div className="panel-title">
        <span className="text-purple-400">🔄</span>
        <span>Why Did the Plan Change?</span>
      </div>

      <div className="space-y-0 divide-y divide-edge">
        {/* Plan selector */}
        {list.length > 1 && (
          <div className="px-4 py-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-2">Plan History</p>
            <div className="flex flex-wrap gap-1.5">
              {list.slice(-8).map(h => (
                <button
                  key={h.plan_id}
                  onClick={() => setSel(h.plan_id)}
                  className={`rounded-lg border px-2.5 py-1 mono text-[10px] font-semibold transition-all ${
                    h.plan_id === entry?.plan_id
                      ? 'border-sky-400/60 bg-sky-500/15 text-sky-300'
                      : 'border-edge text-slate-500 hover:border-edge2 hover:text-slate-300'
                  }`}
                >
                  {h.plan_id}
                  <span className="ml-1 text-slate-600 font-normal">{fmtTime(h.created_at)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {entry && (
          <>
            {/* Trigger / Event */}
            <div className="px-4 py-3">
              <Label text="Triggering Event" />
              <div className="mt-1.5 rounded-lg border border-amber-500/20 bg-amber-500/8 px-3 py-2">
                <p className="text-xs font-medium text-amber-300">{entry.trigger || '—'}</p>
              </div>
            </div>

            {/* Previous vs New plan */}
            <div className="grid grid-cols-2 divide-x divide-edge">
              <div className="px-4 py-3">
                <Label text="Previous Plan" />
                <ul className="mt-1.5 space-y-1">
                  {fmt(entry.previous).map((l, i) => (
                    <li key={i} className="mono text-[11px] text-slate-400 flex items-center gap-1">
                      <span className="text-slate-700">•</span> {l}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="px-4 py-3">
                <Label text="New Plan" />
                <ul className="mt-1.5 space-y-1">
                  {fmt(entry.new).map((l, i) => (
                    <li key={i} className="mono text-[11px] text-green-400 flex items-center gap-1">
                      <span className="text-green-700">›</span> {l}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Changes diff */}
            {entry.changes?.length > 0 && (
              <div className="px-4 py-3">
                <Label text="What Changed" />
                <ul className="mt-1.5 space-y-1.5">
                  {entry.changes.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <span
                        className="mt-0.5 rounded px-1.5 py-0.5 mono text-[10px] font-bold flex-shrink-0"
                        style={
                          c.type === 'added'   ? { color: '#86efac', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' } :
                          c.type === 'removed' ? { color: '#fca5a5', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' } :
                          c.type === 'changed' ? { color: '#fcd34d', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)' } :
                          { color: '#94a3b8', background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.2)' }
                        }
                      >
                        {c.type || 'info'}
                      </span>
                      <span className="text-slate-300">{c.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Reason / Explanation */}
            {entry.reason && (
              <div className="px-4 py-3">
                <Label text="Reason" />
                <p className="mt-1.5 text-xs text-slate-400 leading-relaxed italic border-l-2 border-purple-500/40 pl-3">
                  {entry.reason}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Label({ text }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">{text}</p>
  )
}
