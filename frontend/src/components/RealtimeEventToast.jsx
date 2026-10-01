import { fmtTime } from '../types/constants.js'

/**
 * Real-time Event Toast Notification (Phase 11 Requirement 5)
 * Displays incoming live events with severity accents and dismiss control.
 */
export default function RealtimeEventToast({ notification, onDismiss }) {
  if (!notification) return null

  const isCritical = notification.severity === 'critical'

  const ICONS = {
    NEW_INCIDENT: '📍',
    INCIDENT_SEVERITY_CHANGED: '⚠️',
    RESOURCE_ASSIGNED: '→',
    RESOURCE_UNAVAILABLE: '✗',
    RESOURCE_REASSIGNED: '🔄',
    RESPONSE_PLAN_UPDATED: '📋',
    CRITICAL_ALERT: '🚨',
  }

  const icon = ICONS[notification.type] || '⚡'

  return (
    <div className="fixed top-16 right-6 z-50 max-w-md w-full animate-slide-in">
      <div
        className={`relative overflow-hidden rounded-2xl border p-4 shadow-xl bg-white transition-all ${
          isCritical
            ? 'border-red-300 text-slate-800'
            : 'border-sky-300 text-slate-800'
        }`}
      >
        {/* Top edge accent bar */}
        <div
          className={`absolute top-0 left-0 right-0 h-1.5 ${
            isCritical ? 'bg-red-500' : 'bg-sky-500'
          }`}
        />

        <div className="flex items-start gap-3">
          <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>

          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className={`badge text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                isCritical ? 'bg-red-50 text-red-700 border-red-200' : 'bg-sky-50 text-sky-700 border-sky-200'
              }`}>
                LIVE UPDATE
              </span>
              <span className="font-mono text-[10px] text-slate-500">
                {fmtTime(notification.time)}
              </span>
            </div>

            <h4 className="text-xs font-bold text-slate-900 leading-snug">
              {notification.title}
            </h4>
          </div>

          <button
            onClick={onDismiss}
            className="text-slate-400 hover:text-slate-700 transition-colors text-sm px-1 py-0.5 font-bold"
            title="Dismiss notification"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}
