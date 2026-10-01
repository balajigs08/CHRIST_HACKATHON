import { MOCK_APPROVALS, MOCK_INCIDENTS } from '../data/mockData.js'
import { pretty, fmtTime } from '../types/constants.js'

export default function AlertsPanel({ approvals: propApprovals, incidents: propIncidents }) {
  const approvalList = propApprovals || MOCK_APPROVALS
  const incidentList = propIncidents || MOCK_INCIDENTS
  const pending = approvalList.filter(a => a.status === 'pending')

  if (pending.length === 0) return null

  return (
    <div className="space-y-3">
      {pending.map(a => {
        const inc = incidentList.find(i => i.id === a.incident_id)
        return (
          <div
            key={a.id}
            className="relative overflow-hidden rounded-xl border-2 p-4"
            style={{
              borderColor: '#fca5a5',
              background: 'linear-gradient(135deg,#fef2f2 0%,#fff5f5 100%)',
              boxShadow: '0 2px 16px rgba(239,68,68,0.08)',
            }}
          >
            {/* Animated top border */}
            <div
              className="absolute top-0 left-0 right-0 h-0.5"
              style={{
                background: 'linear-gradient(90deg, transparent, #ef4444, transparent)',
                animation: 'flash 2s ease-in-out infinite',
              }}
            />

            {/* Title */}
            <div className="flex items-start gap-3">
              <span className="text-xl animate-flash flex-shrink-0 mt-0.5">⚠</span>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-black tracking-wider text-red-700 text-sm">HUMAN APPROVAL REQUIRED</h3>
                  <span className="mono text-[10px] text-red-500 border border-red-200 bg-red-50 rounded px-1.5 py-0.5">
                    {a.id}
                  </span>
                  <span className="mono text-[10px] text-red-500 border border-red-200 bg-red-50 rounded px-1.5 py-0.5">
                    {a.incident_id}
                  </span>
                </div>

                {inc && (
                  <p className="mt-1 text-xs text-red-600 italic">{inc.description}</p>
                )}
              </div>
              <span className="mono text-[10px] text-red-400 flex-shrink-0">{fmtTime(a.created_at)}</span>
            </div>

            {/* Details grid */}
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-red-500 mb-1">Shortage Reason</p>
                <p className="text-xs text-red-700 leading-relaxed">{a.reason}</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 mb-1">Recommended Action</p>
                <p className="text-xs font-semibold text-amber-700 leading-relaxed">{a.recommended_action}</p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                id={`alert-approve-${a.id}`}
                className="btn btn-success text-xs px-4 py-2"
                onClick={() => alert(`Mock: Approved ${a.id}`)}
              >
                ✓ APPROVE
              </button>
              <button
                id={`alert-reject-${a.id}`}
                className="btn btn-danger text-xs px-4 py-2"
                onClick={() => alert(`Mock: Rejected ${a.id}`)}
              >
                ✗ REJECT
              </button>
              <button className="btn text-xs px-4 py-2">
                📋 Review Plan
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
