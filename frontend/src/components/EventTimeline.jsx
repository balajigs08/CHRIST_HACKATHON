import { useState } from 'react'
import { fmtTime } from '../types/constants.js'

const EVENT_CONFIG = {
  INCIDENT_CREATED:         { color: '#38bdf8', icon: '📍', label: 'Incident Created',      bg: 'rgba(56,189,248,0.08)' },
  INCIDENT_ESCALATED:       { color: '#f97316', icon: '⬆',  label: 'Escalated',            bg: 'rgba(249,115,22,0.08)' },
  INCIDENT_RESOLVED:        { color: '#22c55e', icon: '✓',  label: 'Resolved',             bg: 'rgba(34,197,94,0.08)'  },
  RESOURCE_UNAVAILABLE:     { color: '#ef4444', icon: '✗',  label: 'Resource Offline',     bg: 'rgba(239,68,68,0.08)'  },
  RESOURCE_AVAILABLE:       { color: '#22c55e', icon: '✓',  label: 'Resource Restored',    bg: 'rgba(34,197,94,0.08)'  },
  RESOURCE_ASSIGNED:        { color: '#22c55e', icon: '→',  label: 'Resource Assigned',    bg: 'rgba(34,197,94,0.08)'  },
  RESOURCE_REALLOCATED:     { color: '#fbbf24', icon: '⇄',  label: 'Reallocated',          bg: 'rgba(251,191,36,0.08)' },
  PLAN_RECALCULATED:        { color: '#a78bfa', icon: '⟳',  label: 'Plan Recalculated',    bg: 'rgba(167,139,250,0.08)'},
  HUMAN_APPROVAL_REQUIRED:  { color: '#ef4444', icon: '⚠',  label: 'Approval Required',    bg: 'rgba(239,68,68,0.12)'  },
  BOUNDARY_COLLAPSE:        { color: '#ef4444', icon: '💥', label: 'Boundary Collapse',    bg: 'rgba(239,68,68,0.12)'  },
  APPROVAL_APPROVED:        { color: '#22c55e', icon: '✔',  label: 'Approved',             bg: 'rgba(34,197,94,0.08)'  },
  APPROVAL_REJECTED:        { color: '#f97316', icon: '✘',  label: 'Rejected',             bg: 'rgba(249,115,22,0.08)' },
  OPTIMIZATION_ERROR:       { color: '#ef4444', icon: '⛔', label: 'Optimizer Error',      bg: 'rgba(239,68,68,0.08)'  },
}

const DEFAULT_CONFIG = { color: '#64748b', icon: '·', label: 'Event', bg: 'transparent' }

const FILTER_GROUPS = [
  { id: 'all',       label: 'All',       match: () => true },
  { id: 'critical',  label: 'Critical',  match: e => ['HUMAN_APPROVAL_REQUIRED','BOUNDARY_COLLAPSE','RESOURCE_UNAVAILABLE'].includes(e.event_type) },
  { id: 'plan',      label: 'Plans',     match: e => ['PLAN_RECALCULATED','RESOURCE_ASSIGNED','RESOURCE_REALLOCATED'].includes(e.event_type) },
  { id: 'incidents', label: 'Incidents', match: e => ['INCIDENT_CREATED','INCIDENT_ESCALATED','INCIDENT_RESOLVED'].includes(e.event_type) },
  { id: 'approval',  label: 'Approvals', match: e => e.event_type.startsWith('APPROVAL') },
]

export default function EventTimeline({ events = [] }) {
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState(null)

  const group = FILTER_GROUPS.find(g => g.id === filter) || FILTER_GROUPS[0]
  const rows  = [...events].reverse().filter(group.match)

  return (
    <div className="panel flex flex-col" style={{ maxHeight: '600px' }}>
      {/* Header */}
      <div className="panel-title flex-wrap gap-2">
        <span className="text-amber-600">📜</span>
        <span>Audit Log</span>
        <span className="mono rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 font-bold">
          {events.length}
        </span>
        {/* Filter chips */}
        <div className="ml-auto flex flex-wrap gap-1 normal-case">
          {FILTER_GROUPS.map(g => (
            <button
              key={g.id}
              onClick={() => setFilter(g.id)}
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-all ${
                filter === g.id
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <ol className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5">
        {rows.length === 0 && (
          <li className="py-8 text-center text-slate-500">
            <div className="flex flex-col items-center gap-2">
              <span className="text-2xl">📋</span>
              <span className="text-sm font-medium">No events yet</span>
            </div>
          </li>
        )}
        {rows.map(e => {
          const cfg = EVENT_CONFIG[e.event_type] || DEFAULT_CONFIG
          const isCritical = ['HUMAN_APPROVAL_REQUIRED','BOUNDARY_COLLAPSE'].includes(e.event_type)
          const isOpen = expanded === e.id

          return (
            <li key={e.id}>
              <button
                className="w-full text-left rounded-lg px-3 py-2.5 transition-all hover:bg-slate-50 group border border-transparent hover:border-slate-200"
                style={{ background: isOpen ? cfg.bg : undefined }}
                onClick={() => setExpanded(isOpen ? null : e.id)}
              >
                <div className="flex items-start gap-2.5">
                  {/* Icon dot */}
                  <div
                    className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[11px] ${isCritical ? 'animate-flash' : ''}`}
                    style={{ background: `${cfg.color}20`, color: cfg.color, border: `1px solid ${cfg.color}40` }}
                  >
                    {cfg.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span
                        className="text-[11px] font-bold"
                        style={{ color: cfg.color }}
                      >
                        {cfg.label}
                      </span>
                      <span className="mono text-[10px] text-slate-400">{e.id}</span>
                      <span className="mono text-[10px] text-slate-500 ml-auto">{fmtTime(e.timestamp)}</span>
                    </div>
                    <p className="text-xs text-slate-700 mt-0.5 leading-relaxed font-normal">{e.description}</p>
                    {isOpen && e.reason && e.reason !== e.description && (
                      <p className="mt-1.5 text-[11px] text-slate-600 border-l-2 border-slate-300 pl-2 italic slide-up bg-slate-50 p-1 rounded-r">
                        {e.reason}
                      </p>
                    )}
                  </div>

                  {/* Expand arrow */}
                  {(e.reason && e.reason !== e.description) && (
                    <span className={`text-slate-400 text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                      ▾
                    </span>
                  )}
                </div>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
