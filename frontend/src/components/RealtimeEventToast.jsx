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
        className={`relative overflow-hidden rounded-2xl border p-4 shadow-2xl backdrop-blur-2xl transition-all ${
          isCritical
            ? 'border-red-500/50 bg-slate-950/95 text-red-200 shadow-red-950/40'
            : 'border-sky-500/50 bg-slate-950/95 text-sky-200 shadow-sky-950/40'
        }`}
      >
        {/* Top glowing edge bar */}
        <div
          className={`absolute top-0 left-0 right-0 h-1 ${
            isCritical ? 'bg-gradient-to-r from-red-500 via-orange-500 to-amber-500' : 'bg-gradient-to-r from-sky-500 via-blue-500 to-purple-500'
          }`}
        />

        <div className="flex items-start gap-3">
          <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>

          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="badge text-[10px] font-mono font-bold bg-slate-900 border border-edge uppercase tracking-wider text-slate-300">
                LIVE UPDATE
              </span>
              <span className="font-mono text-[10px] text-slate-400">
                {fmtTime(notification.time)}
              </span>
            </div>

            <h4 className="text-xs font-bold text-white leading-snug">
              {notification.title}
            </h4>
          </div>

          <button
            onClick={onDismiss}
            className="text-slate-400 hover:text-white transition-colors text-sm px-1 py-0.5"
            title="Dismiss notification"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}
