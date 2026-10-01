import { useState } from 'react'
import { pretty, fmtTime } from '../types/constants.js'

export default function ApprovalPanel({ approvals = [], plan, onApprove, onReject, busy }) {
  const [review, setReview] = useState(false)
  const [decided, setDecided] = useState({})

  const pending   = approvals.filter(a => a.status === 'pending')
  const resolved  = approvals.filter(a => a.status !== 'pending')

  if (pending.length === 0) {
    if (resolved.length === 0) return null
    // Show compact resolved history
    return (
      <div className="rounded-xl border border-edge bg-panel/60 px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>✓</span>
          <span className="uppercase tracking-widest font-semibold">Approvals resolved</span>
          <span className="mono text-slate-600">{resolved.length} decision{resolved.length > 1 ? 's' : ''}</span>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Alert banners for each pending approval */}
      {pending.map(a => (
        <ApprovalBanner
          key={a.id}
          approval={a}
          busy={busy || !!decided[a.id]}
          decided={decided[a.id]}
          onApprove={() => { setDecided(d => ({ ...d, [a.id]: 'approved' })); onApprove(a.id) }}
          onReject={() => { setDecided(d => ({ ...d, [a.id]: 'rejected' })); onReject(a.id) }}
          onReview={() => setReview(true)}
        />
      ))}

      {/* Review modal */}
      {review && (
        <ReviewModal plan={plan} onClose={() => setReview(false)} />
      )}
    </>
  )
}

function ApprovalBanner({ approval: a, busy, decided, onApprove, onReject, onReview }) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-red-200 bg-red-50/70 p-5 shadow-sm"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-red-600 text-xl font-bold">⚠</span>
            <h2 className="font-bold tracking-wider text-red-700 text-base">HUMAN APPROVAL REQUIRED</h2>
          </div>
          <p className="mt-0.5 text-xs text-red-600/80">
            Critical resource shortage · {a.id}
            {a.created_at && <span className="ml-2 text-red-500 font-mono">{fmtTime(a.created_at)}</span>}
          </p>
        </div>
        <div className="flex-shrink-0 rounded-full border border-red-300 bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-700 uppercase tracking-wider">
          PENDING
        </div>
      </div>

      {/* Details */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <InfoBlock label="Shortage Details" value={a.reason} />
        <InfoBlock label="Recommended Action" value={a.recommended_action} highlight />
      </div>

      {/* Action buttons */}
      {decided ? (
        <div className="mt-4 flex items-center gap-2 text-sm">
          <span className={decided === 'approved' ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold'}>
            {decided === 'approved' ? '✓ Approved' : '✗ Rejected'}
          </span>
          <span className="text-slate-500 text-xs">— waiting for confirmation…</span>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            id={`approve-${a.id}`}
            disabled={busy}
            onClick={onApprove}
            className="btn btn-success text-sm px-5 py-2.5"
          >
            ✓ APPROVE
          </button>
          <button
            id={`reject-${a.id}`}
            disabled={busy}
            onClick={onReject}
            className="btn btn-danger text-sm px-5 py-2.5"
          >
            ✗ REJECT
          </button>
          <button
            onClick={onReview}
            className="btn bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm px-5 py-2.5"
          >
            📋 Review Plan
          </button>
        </div>
      )}
    </div>
  )
}

function InfoBlock({ label, value, highlight }) {
  return (
    <div className="rounded-lg border border-red-200 bg-white px-3.5 py-2.5 shadow-xs">
      <p className="text-[10px] font-bold uppercase tracking-wider text-red-800/70 mb-1">{label}</p>
      <p className={`text-sm leading-relaxed ${highlight ? 'font-semibold text-amber-800' : 'text-slate-800'}`}>
        {value || '—'}
      </p>
    </div>
  )
}

function ReviewModal({ plan, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="panel w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl bg-white rounded-xl border border-slate-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="font-bold text-slate-800 text-base">
              Plan Review — {plan?.plan_id}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Current resource allocation before approval</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none transition-colors p-1"
          >
            ✕
          </button>
        </div>

        {/* Explanation */}
        {plan?.explanation && (
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-600 italic">
            {plan.explanation}
          </div>
        )}

        {/* Assignments list */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {plan?.assignments?.length > 0 && (
            <>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3">
                Assignments ({plan.assignments.length})
              </p>
              <ul className="space-y-1.5">
                {plan.assignments.map(x => (
                  <li key={x.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs">
                    <span className="mono font-bold text-sky-700 w-14 flex-shrink-0">{x.incident_id}</span>
                    <span className="text-slate-400">←</span>
                    <span className="mono font-semibold text-slate-700">{x.resource_id}</span>
                    <span className="text-slate-600">{pretty(x.resource_type)}</span>
                    <span className="ml-auto text-slate-500 font-mono">{x.eta} min ETA</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {plan?.unassigned_incidents?.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-red-600 mb-3">
                Unassigned ({plan.unassigned_incidents.length})
              </p>
              <ul className="space-y-1.5">
                {plan.unassigned_incidents.map(u => (
                  <li key={u.incident_id} className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50/50 px-3 py-2 text-xs">
                    <span className="mono font-bold text-red-700 w-14 flex-shrink-0">{u.incident_id}</span>
                    <span className="text-red-700 font-medium">missing: {u.missing_resources.map(pretty).join(', ')}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 px-5 py-3 bg-slate-50 rounded-b-xl">
          <button onClick={onClose} className="btn btn-primary w-full">Close Review</button>
        </div>
      </div>
    </div>
  )
}
