import { useEffect } from 'react'
import { SEVERITY, INCIDENT_STATUS, INCIDENT_ICON, pretty, prettyCap, fmtDate, fmtTime, timeSince } from '../types/constants.js'

export default function IncidentDetailPanel({ incident, onClose, onToggleStatus }) {
  if (!incident) return null

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const sev = SEVERITY[incident.severity] || SEVERITY.medium
  const statusInfo = INCIDENT_STATUS[incident.status] || {
    label: prettyCap(incident.status),
    color: '#64748b',
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
  }
  const icon = INCIDENT_ICON[incident.type] || INCIDENT_ICON.default
  const isCritical = incident.severity === 'critical'
  const isResolved = incident.status === 'resolved'
  const isWaiting = incident.status === 'waiting'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} aria-label="Close modal overlay" />

      {/* Slide-over panel */}
      <div className="relative z-10 flex h-full w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-2xl slide-in overflow-hidden">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-xl border border-slate-200">
              {icon}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="mono text-base font-bold text-slate-900 tracking-wide">{incident.id}</span>
                <span
                  className="badge font-semibold"
                  style={{ color: sev.color, borderColor: `${sev.color}50`, background: `${sev.color}15` }}
                >
                  {sev.label}
                </span>
                <span
                  className={`badge font-semibold ${isWaiting ? 'animate-flash' : ''}`}
                  style={{ color: statusInfo.color, borderColor: `${statusInfo.color}50`, background: `${statusInfo.color}15` }}
                >
                  {isWaiting && '⏳ '}{statusInfo.label}
                </span>
              </div>
              <p className="text-xs text-slate-500 capitalize mt-0.5">{pretty(incident.type)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onToggleStatus && (
              <button
                onClick={() => onToggleStatus(incident.id)}
                className={`btn text-xs ${isResolved ? 'btn-sim' : 'btn-success'}`}
                title={isResolved ? 'Re-open incident' : 'Mark incident as resolved'}
              >
                {isResolved ? '↩ Re-open' : '✓ Resolve Incident'}
              </button>
            )}
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 bg-slate-50/50">

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Urgency</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className={`text-lg font-bold mono ${incident.urgency >= 8 ? 'text-red-600' : 'text-amber-600'}`}>
                  {incident.urgency ?? 5}
                </span>
                <span className="text-xs text-slate-400">/ 10</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Reported</span>
              <div className="mt-1 text-sm font-semibold text-slate-800">
                {timeSince(incident.created_at)}
              </div>
              <div className="mono text-[10px] text-slate-400 truncate">{fmtTime(incident.created_at)}</div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Waiting Time</span>
              <div className="mt-1 text-sm font-semibold text-slate-800">
                {incident.waiting_time > 0 ? `${Math.round(incident.waiting_time)} min` : '0 min'}
              </div>
              <div className="text-[10px] text-slate-500">{isWaiting ? 'Pending dispatch' : 'Engaged'}</div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Fleet Units</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-lg font-bold mono text-sky-700">
                  {incident.assigned_resources?.length || 0}
                </span>
                <span className="text-xs text-slate-400">assigned</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="panel p-4 bg-white border-slate-200 shadow-2xs">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-2">
              <span>📋</span> Description & Assessment
            </h4>
            <p className="text-sm text-slate-800 leading-relaxed font-normal">
              {incident.description}
            </p>
          </div>

          {/* Location & Geo-Coordinates */}
          <div className="panel p-4 space-y-3 bg-white border-slate-200 shadow-2xs">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <span>📍</span> Location Details
            </h4>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-slate-50 border border-slate-200 p-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">{incident.location_name}</p>
                <p className="mono text-xs text-slate-500 mt-0.5">
                  Lat: {incident.latitude ? incident.latitude.toFixed(4) : '—'}, Lng: {incident.longitude ? incident.longitude.toFixed(4) : '—'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="mono text-[11px] bg-slate-200 px-2.5 py-1 rounded text-slate-700 font-medium">
                  Zone: Central Tactical Grid
                </span>
              </div>
            </div>
          </div>

          {/* Resource Status & Shortages */}
          <div className="panel p-4 space-y-4 bg-white border-slate-200 shadow-2xs">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <span>🚒</span> Resource Allocation & Requirements
            </h4>

            {/* Missing resources alert if any */}
            {incident.missing_resources && incident.missing_resources.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs flex items-start gap-2.5">
                <span className="text-red-600 text-sm mt-0.5 font-bold">⚠</span>
                <div>
                  <p className="font-bold text-red-800">Resource Shortage Detected</p>
                  <p className="text-red-700/90 mt-0.5 font-normal">
                    Deficit on {incident.missing_resources.map(pretty).join(', ')}. Automated priority reallocation or mutual aid approval required.
                  </p>
                </div>
              </div>
            )}

            {/* Required resources list */}
            <div>
              <p className="text-[11px] font-medium text-slate-500 mb-2">Required Fleet Types:</p>
              <div className="flex flex-wrap gap-2">
                {incident.required_resources?.map((r) => {
                  const isMissing = incident.missing_resources?.includes(r)
                  return (
                    <span
                      key={r}
                      className="badge px-3 py-1 text-xs font-semibold"
                      style={
                        isMissing
                          ? { color: '#b91c1c', borderColor: '#fca5a5', background: '#fef2f2' }
                          : { color: '#15803d', borderColor: '#bbf7d0', background: '#f0fdf4' }
                      }
                    >
                      {isMissing ? '✕ Missing: ' : '✓ Assigned: '}{prettyCap(r)}
                    </span>
                  )
                })}
              </div>
            </div>

            {/* Assigned units list */}
            <div>
              <p className="text-[11px] font-medium text-slate-500 mb-2">Deployed Unit IDs:</p>
              {incident.assigned_resources && incident.assigned_resources.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {incident.assigned_resources.map((unitId) => (
                    <div
                      key={unitId}
                      className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5"
                    >
                      <span className="h-2 w-2 rounded-full bg-sky-600 animate-pulse" />
                      <span className="mono text-xs font-bold text-sky-800">{unitId}</span>
                      <span className="text-[10px] text-sky-600 border-l border-sky-200 pl-2 font-medium">Active</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs italic text-slate-400">No units currently assigned to this incident.</p>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="panel p-4 space-y-4 bg-white border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <span>⏱</span> Incident Action Timeline
              </h4>
              <span className="mono text-[10px] text-slate-500 font-medium">
                {incident.timeline?.length || 0} event{incident.timeline?.length === 1 ? '' : 's'} logged
              </span>
            </div>

            <div className="mt-4 pt-2">
              {incident.timeline && incident.timeline.length > 0 ? (
                incident.timeline.map((item, idx) => (
                  <div key={idx} className="timeline-item">
                    <span
                      className="timeline-dot"
                      style={{
                        borderColor: idx === 0 ? sev.color : '#0284c7',
                        background: '#ffffff',
                      }}
                    />
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-semibold text-slate-800">{item.title}</span>
                      <span className="mono text-[10px] text-slate-500">{fmtDate(item.time)}</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed font-normal">{item.description}</p>
                    {item.actor && (
                      <span className="inline-block mt-1 text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        Actor: {item.actor}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="timeline-item">
                  <span className="timeline-dot border-sky-500" style={{ background: '#ffffff' }} />
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800">Incident Registered</span>
                    <span className="mono text-[10px] text-slate-500">{fmtDate(incident.created_at)}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">Incident officially logged into Crisis Command system.</p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-3.5">
          <span className="mono text-[11px] text-slate-500">
            System ID: {incident.id} · Ref: CC-2026
          </span>
          <button
            onClick={onClose}
            className="btn bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-5 py-2 text-xs font-medium shadow-2xs"
          >
            Close Panel
          </button>
        </div>

      </div>
    </div>
  )
}
