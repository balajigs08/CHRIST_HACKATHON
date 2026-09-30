import { useState } from 'react'
import { MOCK_EVENTS } from '../data/mockData.js'
import { fmtTime, timeSince } from '../types/constants.js'

const EVENT_CFG = {
  INCIDENT_CREATED:        { color: '#38bdf8', icon: '📍', label: 'Incident Created'       },
  INCIDENT_ESCALATED:      { color: '#f97316', icon: '⬆',  label: 'Escalated'              },
  INCIDENT_RESOLVED:       { color: '#22c55e', icon: '✓',  label: 'Resolved'               },
  RESOURCE_UNAVAILABLE:    { color: '#ef4444', icon: '✗',  label: 'Resource Offline'        },
  RESOURCE_AVAILABLE:      { color: '#22c55e', icon: '✓',  label: 'Resource Restored'       },
  RESOURCE_ASSIGNED:       { color: '#22c55e', icon: '→',  label: 'Resource Assigned'       },
  RESOURCE_REALLOCATED:    { color: '#fbbf24', icon: '⇄',  label: 'Reallocated'             },
  PLAN_RECALCULATED:       { color: '#a78bfa', icon: '⟳',  label: 'Plan Recalculated'       },
  HUMAN_APPROVAL_REQUIRED: { color: '#ef4444', icon: '👤', label: 'Approval Required'       },
  BOUNDARY_COLLAPSE:       { color: '#ef4444', icon: '💥', label: 'Boundary Collapse'       },
  APPROVAL_APPROVED:       { color: '#22c55e', icon: '✔',  label: 'Approved'               },
  APPROVAL_REJECTED:       { color: '#f97316', icon: '✘',  label: 'Rejected'               },
}
const DEF = { color: '#64748b', icon: '·', label: 'Event' }

export default function RecentEventsPanel({ maxItems = 12, events: propEvents }) {
  const [filter, setFilter] = useState('all')

  const eventList = propEvents || MOCK_EVENTS

  const filters = [
    { id: 'all',       label: 'All',       match: () => true },
    { id: 'critical',  label: 'Critical',  match: e => ['HUMAN_APPROVAL_REQUIRED','RESOURCE_UNAVAILABLE','BOUNDARY_COLLAPSE'].includes(e.event_type) },
    { id: 'plan',      label: 'Plans',     match: e => e.event_type.startsWith('PLAN') || e.event_type.startsWith('RESOURCE_A') },
    { id: 'incidents', label: 'Incidents', match: e => e.event_type.startsWith('INCIDENT') },
  ]

  const activeFilter = filters.find(f => f.id === filter) || filters[0]
  const shown = eventList.filter(activeFilter.match).slice(0, maxItems)

  return (
    <div className="panel flex flex-col" style={{ maxHeight: '480px' }}>
      <div className="panel-title flex-wrap gap-2">
        <span className="text-amber-400">📜</span>
        <span>Recent Events</span>
        <span className="mono rounded-full bg-edge px-2 py-0.5 text-[10px] text-slate-400">
          {eventList.length}
        </span>
        <div className="ml-auto flex flex-wrap gap-1 normal-case">
          {filters.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-all ${
                filter === f.id
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-slate-600 hover:text-slate-400'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <ol className="flex-1 overflow-y-auto divide-y divide-edge/30">
        {shown.length === 0 && (
          <li className="py-8 text-center text-slate-600 text-sm">No events</li>
        )}
        {shown.map(e => {
          const cfg = EVENT_CFG[e.event_type] || DEF
          const isCrit = e.event_type === 'HUMAN_APPROVAL_REQUIRED' || e.event_type === 'BOUNDARY_COLLAPSE'

          return (
            <li key={e.id} className="px-4 py-2.5 hover:bg-panel2/40 transition-colors">
              <div className="flex items-start gap-2.5">
                <div
                  className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] ${isCrit ? 'animate-flash' : ''}`}
                  style={{ background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}35` }}
                >
                  {cfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-[11px] font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
                    <span className="mono text-[10px] text-slate-700">{e.id}</span>
                    <span className="mono text-[10px] text-slate-700 ml-auto">{timeSince(e.timestamp)}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mt-0.5">{e.description}</p>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
