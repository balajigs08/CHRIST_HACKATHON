import { useEffect } from 'react'
import {
  RESOURCE_STATUS,
  RESOURCE_ICON,
  RESOURCE_TYPE_LABELS,
  pretty,
  prettyCap,
  fmtDate,
  timeSince,
} from '../types/constants.js'

export default function ResourceDetailPanel({ resource, onClose, onStatusChange }) {
  if (!resource) return null

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const icon = RESOURCE_ICON[resource.type] || '🚚'
  const typeLabel = RESOURCE_TYPE_LABELS[resource.type] || prettyCap(resource.type)
  const st = RESOURCE_STATUS[resource.status] || {
    label: prettyCap(resource.status),
    color: '#94a3b8',
    badge: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
  }
  const isAssigned = resource.status === 'assigned'
  const isAvailable = resource.status === 'available'
  const isMaintenance = resource.status === 'maintenance'
  const isUnavailable = resource.status === 'unavailable'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm transition-opacity">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} aria-label="Close modal overlay" />

      {/* Slide-over panel */}
      <div className="relative z-10 flex h-full w-full max-w-2xl flex-col border-l border-edge bg-surface shadow-2xl slide-in overflow-hidden">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-edge bg-panel/90 px-6 py-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-edge/80 text-2xl border border-edge-2">
              {icon}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="mono text-base font-bold text-white tracking-wide">{resource.id}</span>
                <span className="text-xs font-semibold text-sky-400/90 mono">
                  [{resource.callsign || 'UNIT'}]
                </span>
                <span
                  className="badge"
                  style={{
                    color: st.color,
                    borderColor: `${st.color}50`,
                    background: `${st.color}15`,
                  }}
                >
                  {st.label}
                </span>
              </div>
              <p className="text-xs text-slate-400 capitalize mt-0.5">{typeLabel}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-edge-2 bg-panel2 text-slate-400 hover:text-white hover:bg-edge transition-all"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-edge bg-panel/60 p-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Status</span>
              <div className="mt-1 flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: st.color, boxShadow: `0 0 6px ${st.color}` }}
                />
                <span className="text-xs font-bold text-slate-200 capitalize">{st.label}</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                {isAssigned ? `ETA: ${resource.eta ?? '—'}m` : 'Ready'}
              </div>
            </div>

            <div className="rounded-xl border border-edge bg-panel/60 p-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Assignment</span>
              <div className="mt-1 text-xs font-bold mono text-sky-300">
                {resource.current_assignment || 'Standby'}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                {resource.current_assignment ? 'Active dispatch' : 'No active incident'}
              </div>
            </div>

            <div className="rounded-xl border border-edge bg-panel/60 p-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Crew Size</span>
              <div className="mt-1 text-sm font-bold text-slate-200 mono">
                {resource.crew_size > 0 ? `${resource.crew_size} personnel` : '0 (Automated/Tech)'}
              </div>
              <div className="text-[10px] text-slate-500 truncate">{resource.commander || 'Lead Officer'}</div>
            </div>

            <div className="rounded-xl border border-edge bg-panel/60 p-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Telemetry</span>
              <div className="mt-1 text-xs font-semibold text-slate-300">
                {timeSince(resource.last_updated)}
              </div>
              <div className="text-[10px] text-slate-500">GPS Ping active</div>
            </div>
          </div>

          {/* Quick Status Control */}
          {onStatusChange && (
            <div className="panel p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-200">Operational Override</p>
                <p className="text-[11px] text-slate-400">Manually update unit readiness status in tactical command.</p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {['available', 'assigned', 'unavailable', 'maintenance'].map((statusKey) => {
                  const sConf = RESOURCE_STATUS[statusKey]
                  const isCurrent = resource.status === statusKey
                  return (
                    <button
                      key={statusKey}
                      onClick={() => onStatusChange(resource.id, statusKey)}
                      disabled={isCurrent}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize border transition-all ${
                        isCurrent
                          ? 'border-transparent shadow text-white font-bold opacity-100 cursor-default'
                          : 'border-edge bg-panel2/50 text-slate-400 hover:text-white hover:bg-edge opacity-70 hover:opacity-100'
                      }`}
                      style={isCurrent ? { backgroundColor: sConf.color } : {}}
                    >
                      {isCurrent ? `✓ ${statusKey}` : statusKey}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Assigned Incident Detail Card */}
          {resource.current_assignment ? (
            <div className="panel p-4 space-y-2 border-sky-500/30 bg-sky-500/5">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-sky-400 flex items-center gap-2">
                  <span>🚨</span> Assigned Incident
                </h4>
                <span className="mono text-xs font-bold text-white bg-sky-500/20 px-2 py-0.5 rounded border border-sky-500/40">
                  {resource.current_assignment}
                </span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                Unit currently dispatched to incident <span className="mono text-sky-300">{resource.current_assignment}</span> at <span className="font-semibold">{resource.location_name}</span>.
              </p>
              <div className="flex items-center gap-4 text-xs text-slate-400 pt-1">
                <span>ETA: <strong className="text-white mono">{resource.eta ?? '—'} mins</strong></span>
                <span>Role: <strong className="text-white">Primary Response Unit</strong></span>
              </div>
            </div>
          ) : (
            <div className="panel p-4 flex items-center gap-3 text-xs text-slate-400">
              <span className="text-emerald-400 text-base">✓</span>
              <div>
                <p className="font-semibold text-slate-300">Unit on Standby</p>
                <p className="text-slate-500 text-[11px]">This unit is unassigned and available for deployment by the optimizer.</p>
              </div>
            </div>
          )}

          {/* Location & Tactical Base */}
          <div className="panel p-4 space-y-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <span>📍</span> Station & Geo-Position
            </h4>
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 rounded-lg bg-panel2/60 border border-edge p-3">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500">Current Field Location</span>
                  <p className="text-xs font-semibold text-slate-200 mt-0.5">{resource.location_name}</p>
                </div>
                <div className="mono text-[11px] text-slate-400">
                  Lat: {resource.latitude?.toFixed(4)}, Lng: {resource.longitude?.toFixed(4)}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 rounded-lg bg-panel2/60 border border-edge p-3">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500">Home Base / Depot</span>
                  <p className="text-xs font-semibold text-slate-300 mt-0.5">{resource.base_station || 'Central Depot'}</p>
                </div>
                <span className="mono text-[11px] bg-edge px-2 py-0.5 rounded text-slate-400">
                  Tactical Zone Central
                </span>
              </div>
            </div>
          </div>

          {/* Capabilities & Equipment */}
          <div className="panel p-4 space-y-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <span>🧰</span> Capabilities & Equipment Profile
            </h4>
            <div className="flex flex-wrap gap-2">
              {resource.capabilities && resource.capabilities.length > 0 ? (
                resource.capabilities.map((cap, i) => (
                  <span
                    key={i}
                    className="rounded-lg border border-edge bg-panel2 px-3 py-1 text-xs font-medium text-slate-300 flex items-center gap-1.5"
                  >
                    <span className="text-sky-400">⚡</span>
                    <span>{cap}</span>
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-500">Standard operational equipment kit.</span>
              )}
            </div>

            {resource.status_reason && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200/90 flex items-start gap-2 mt-2">
                <span className="text-amber-400 mt-0.5">ℹ️</span>
                <div>
                  <span className="font-bold">Maintenance / Status Notice:</span>
                  <p className="mt-0.5">{resource.status_reason}</p>
                </div>
              </div>
            )}
          </div>

          {/* Recent Activity Log */}
          <div className="panel p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <span>⏱</span> Unit Activity Log
              </h4>
              <span className="mono text-[10px] text-slate-500">
                {resource.activity_log?.length || 0} event{resource.activity_log?.length === 1 ? '' : 's'} recorded
              </span>
            </div>

            <div className="mt-3 pt-2">
              {resource.activity_log && resource.activity_log.length > 0 ? (
                resource.activity_log.map((item, idx) => (
                  <div key={idx} className="timeline-item">
                    <span
                      className="timeline-dot"
                      style={{
                        borderColor: idx === 0 ? st.color : '#3b82f6',
                        background: '#060d1a',
                      }}
                    />
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-semibold text-slate-200">{item.title}</span>
                      <span className="mono text-[10px] text-slate-500">{fmtDate(item.time)}</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{item.description}</p>
                  </div>
                ))
              ) : (
                <div className="timeline-item">
                  <span className="timeline-dot border-sky-500" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200">Unit Active in Service</span>
                    <span className="mono text-[10px] text-slate-500">{fmtDate(resource.last_updated)}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Normal telemetry ping recorded at central dispatch.</p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t border-edge bg-panel/90 px-6 py-3.5 backdrop-blur-md">
          <span className="mono text-[11px] text-slate-500">
            Resource ID: {resource.id} · Category: {typeLabel}
          </span>
          <button onClick={onClose} className="btn px-5 py-2 text-xs">
            Close Panel
          </button>
        </div>

      </div>
    </div>
  )
}
