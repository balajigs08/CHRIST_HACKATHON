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
        <div className="panel-title"><span className="text-purple-600">🔄</span> Plan Change History</div>
        <div className="px-4 py-8 text-center text-slate-500">
          <div className="text-2xl mb-2">📋</div>
          <p className="text-sm font-medium">No plan changes yet</p>
          <p className="text-xs mt-1 text-slate-400">Plan diff will appear when the optimizer runs</p>
        </div>
      </div>
    )
  }

  return (
    <div className="panel">
      {/* Header */}
      <div className="panel-title">
        <span className="text-purple-600">🔄</span>
        <span>Why Did the Plan Change?</span>
      </div>

      <div className="space-y-0 divide-y divide-slate-200">
        {/* Plan selector */}
        {list.length > 1 && (
          <div className="px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">Plan History</p>
            <div className="flex flex-wrap gap-1.5">
              {list.slice(-8).map(h => (
                <button
                  key={h.plan_id}
                  onClick={() => setSel(h.plan_id)}
                  className={`rounded-lg border px-2.5 py-1 mono text-[10px] font-semibold transition-all ${
                    h.plan_id === entry?.plan_id
                      ? 'border-sky-300 bg-sky-50 text-sky-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-800'
                  }`}
                >
                  {h.plan_id}
                  <span className="ml-1 text-slate-400 font-normal">{fmtTime(h.created_at)}</span>
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
              <div className="mt-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-xs font-semibold text-amber-800">{entry.trigger || '—'}</p>
              </div>
            </div>

            {/* Previous vs New plan */}
            <div className="grid grid-cols-2 divide-x divide-slate-200">
              <div className="px-4 py-3">
                <Label text="Previous Plan" />
                <ul className="mt-1.5 space-y-1">
                  {fmt(entry.previous).map((l, i) => (
                    <li key={i} className="mono text-[11px] text-slate-600 flex items-center gap-1">
                      <span className="text-slate-400">•</span> {l}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="px-4 py-3">
                <Label text="New Plan" />
                <ul className="mt-1.5 space-y-1">
                  {fmt(entry.new).map((l, i) => (
                    <li key={i} className="mono text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                      <span className="text-emerald-500">›</span> {l}
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
                          c.type === 'added'   ? { color: '#15803d', background: '#f0fdf4', border: '1px solid #bbf7d0' } :
                          c.type === 'removed' ? { color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca' } :
                          c.type === 'changed' ? { color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a' } :
                          { color: '#475569', background: '#f8fafc', border: '1px solid #e2e8f0' }
                        }
                      >
                        {c.type || 'info'}
                      </span>
                      <span className="text-slate-700 font-medium">{c.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Reason / Explanation */}
            {entry.reason && (
              <div className="px-4 py-3">
                <Label text="Reason" />
                <p className="mt-1.5 text-xs text-slate-600 leading-relaxed italic border-l-2 border-purple-400 pl-3 bg-purple-50/30 py-1 rounded-r">
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
    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{text}</p>
  )
}
