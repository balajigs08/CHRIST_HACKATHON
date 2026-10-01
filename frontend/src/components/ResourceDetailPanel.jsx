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
    color: '#64748b',
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
  }
  const isAssigned = resource.status === 'assigned'
  const isAvailable = resource.status === 'available'
  const isMaintenance = resource.status === 'maintenance'
  const isUnavailable = resource.status === 'unavailable'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} aria-label="Close modal overlay" />

      {/* Slide-over panel */}
      <div className="relative z-10 flex h-full w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-2xl slide-in overflow-hidden">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-2xl border border-slate-200">
              {icon}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="mono text-base font-bold text-slate-900 tracking-wide">{resource.id}</span>
                <span className="text-xs font-semibold text-sky-700 mono">
                  [{resource.callsign || 'UNIT'}]
                </span>
                <span
                  className="badge font-semibold"
                  style={{
                    color: st.color,
                    borderColor: `${st.color}50`,
                    background: `${st.color}15`,
                  }}
                >
                  {st.label}
                </span>
              </div>
              <p className="text-xs text-slate-500 capitalize mt-0.5">{typeLabel}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</span>
              <div className="mt-1 flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: st.color, boxShadow: `0 0 6px ${st.color}` }}
                />
                <span className="text-xs font-bold text-slate-800 capitalize">{st.label}</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                {isAssigned ? `ETA: ${resource.eta ?? '—'}m` : 'Ready'}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Assignment</span>
              <div className="mt-1 text-xs font-bold mono text-sky-700">
                {resource.current_assignment || 'Standby'}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                {resource.current_assignment ? 'Active dispatch' : 'No active incident'}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Crew Size</span>
              <div className="mt-1 text-sm font-bold text-slate-800 mono">
                {resource.crew_size > 0 ? `${resource.crew_size} personnel` : '0 (Automated/Tech)'}
              </div>
              <div className="text-[10px] text-slate-400 truncate">{resource.commander || 'Lead Officer'}</div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Telemetry</span>
              <div className="mt-1 text-xs font-semibold text-slate-800">
                {timeSince(resource.last_updated)}
              </div>
              <div className="text-[10px] text-slate-400">GPS Ping active</div>
            </div>
          </div>

          {/* Quick Status Control */}
          {onStatusChange && (
            <div className="panel p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border-slate-200 shadow-2xs">
              <div>
                <p className="text-xs font-bold text-slate-800">Operational Override</p>
                <p className="text-[11px] text-slate-500">Manually update unit readiness status in tactical command.</p>
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
                          ? 'border-transparent shadow-sm text-white font-bold opacity-100 cursor-default'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 opacity-80 hover:opacity-100'
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
            <div className="panel p-4 space-y-2 border-sky-200 bg-sky-50/70 shadow-2xs">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-sky-700 flex items-center gap-2">
                  <span>🚨</span> Assigned Incident
                </h4>
                <span className="mono text-xs font-bold text-sky-800 bg-sky-100 px-2 py-0.5 rounded border border-sky-300">
                  {resource.current_assignment}
                </span>
              </div>
              <p className="text-xs text-slate-800 leading-relaxed">
                Unit currently dispatched to incident <span className="mono font-semibold text-sky-700">{resource.current_assignment}</span> at <span className="font-semibold">{resource.location_name}</span>.
              </p>
              <div className="flex items-center gap-4 text-xs text-slate-600 pt-1 font-medium">
                <span>ETA: <strong className="text-slate-900 mono">{resource.eta ?? '—'} mins</strong></span>
                <span>Role: <strong className="text-slate-900">Primary Response Unit</strong></span>
              </div>
            </div>
          ) : (
            <div className="panel p-4 flex items-center gap-3 text-xs text-slate-600 bg-white border-slate-200 shadow-2xs">
              <span className="text-emerald-600 text-base font-bold">✓</span>
              <div>
                <p className="font-semibold text-slate-800">Unit on Standby</p>
                <p className="text-slate-500 text-[11px]">This unit is unassigned and available for deployment by the optimizer.</p>
              </div>
            </div>
          )}

          {/* Location & Tactical Base */}
          <div className="panel p-4 space-y-3 bg-white border-slate-200 shadow-2xs">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <span>📍</span> Station & Geo-Position
            </h4>
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 rounded-lg bg-slate-50 border border-slate-200 p-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">Current Field Location</span>
                  <p className="text-xs font-semibold text-slate-800 mt-0.5">{resource.location_name}</p>
                </div>
                <div className="mono text-[11px] text-slate-500 font-medium">
                  Lat: {resource.latitude?.toFixed(4)}, Lng: {resource.longitude?.toFixed(4)}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 rounded-lg bg-slate-50 border border-slate-200 p-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">Home Base / Depot</span>
                  <p className="text-xs font-semibold text-slate-800 mt-0.5">{resource.base_station || 'Central Depot'}</p>
                </div>
                <span className="mono text-[11px] bg-slate-200 px-2 py-0.5 rounded text-slate-700 font-medium">
                  Tactical Zone Central
                </span>
              </div>
            </div>
          </div>

          {/* Capabilities & Equipment */}
          <div className="panel p-4 space-y-3 bg-white border-slate-200 shadow-2xs">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <span>🧰</span> Capabilities & Equipment Profile
            </h4>
            <div className="flex flex-wrap gap-2">
              {resource.capabilities && resource.capabilities.length > 0 ? (
                resource.capabilities.map((cap, i) => (
                  <span
                    key={i}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 flex items-center gap-1.5"
                  >
                    <span className="text-sky-600">⚡</span>
                    <span>{cap}</span>
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-500">Standard operational equipment kit.</span>
              )}
            </div>

            {resource.status_reason && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-start gap-2 mt-2">
                <span className="text-amber-600 mt-0.5">ℹ️</span>
                <div>
                  <span className="font-bold">Maintenance / Status Notice:</span>
                  <p className="mt-0.5">{resource.status_reason}</p>
                </div>
              </div>
            )}
          </div>

          {/* Recent Activity Log */}
          <div className="panel p-4 space-y-4 bg-white border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <span>⏱</span> Unit Activity Log
              </h4>
              <span className="mono text-[10px] text-slate-500 font-medium">
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
                        borderColor: idx === 0 ? st.color : '#0284c7',
                        background: '#ffffff',
                      }}
                    />
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-semibold text-slate-800">{item.title}</span>
                      <span className="mono text-[10px] text-slate-500">{fmtDate(item.time)}</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed font-normal">{item.description}</p>
                  </div>
                ))
              ) : (
                <div className="timeline-item">
                  <span className="timeline-dot border-sky-500" style={{ background: '#ffffff' }} />
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800">Unit Active in Service</span>
                    <span className="mono text-[10px] text-slate-500">{fmtDate(resource.last_updated)}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">Normal telemetry ping recorded at central dispatch.</p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-3.5">
          <span className="mono text-[11px] text-slate-500">
            Resource ID: {resource.id} · Category: {typeLabel}
          </span>
          <button onClick={onClose} className="btn bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-5 py-2 text-xs font-medium shadow-2xs">
            Close Panel
          </button>
        </div>

      </div>
    </div>
  )
}
