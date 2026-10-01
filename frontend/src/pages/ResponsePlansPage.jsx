import { useState, useMemo, useEffect } from 'react'
import {
  MOCK_PLAN,
  MOCK_INCIDENTS,
  MOCK_RESOURCES,
  MOCK_PLAN_HISTORY,
} from '../data/mockData.js'
import {
  SEVERITY,
  RESOURCE_STATUS,
  RESOURCE_ICON,
  INCIDENT_ICON,
  RESOURCE_TYPE_LABELS,
  PLAN_STATUS,
  pretty,
  prettyCap,
  fmtTime,
  fmtDate,
  timeSince,
} from '../types/constants.js'

export default function ResponsePlansPage() {
  const [currentPlan, setCurrentPlan] = useState(MOCK_PLAN)
  const [planHistory, setPlanHistory] = useState(MOCK_PLAN_HISTORY)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [assignmentFilter, setAssignmentFilter] = useState('all')

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(timer)
  }, [toast])

  // Refresh plan simulated action
  const handleRefreshPlan = () => {
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setToast({
        type: 'info',
        message: `Response Plan ${currentPlan.plan_id} telemetry re-synchronized.`,
      })
    }, 450)
  }

  // Simulate plan update (frontend-only state transition)
  const handleSimulateUpdate = () => {
    setLoading(true)
    setTimeout(() => {
      const now = new Date().toISOString()
      const newPlanId = `PLN00${Number(currentPlan.plan_id.replace('PLN00', '')) + 1}`
      const newPlan = {
        ...currentPlan,
        plan_id: newPlanId,
        status: 'updated',
        last_updated: now,
        priority: 'Priority Level 1 (Dynamic Rebalance)',
        explanation: `Optimizer dynamically recomputed allocation in response to new emergency traffic telemetry. 2 reserve units deployed.`,
        changes: [
          {
            id: `CHG${Math.floor(10 + Math.random() * 90)}`,
            type: 'reassigned',
            description: 'Ambulance A03 pre-positioned from Cubbon Park to Indiranagar corridor',
            time: fmtTime(now),
          },
          {
            id: `CHG${Math.floor(10 + Math.random() * 90)}`,
            type: 'dispatched',
            description: 'Standby Fire Unit F04 dispatched to support Majestic traffic cordon',
            time: fmtTime(now),
          },
          ...currentPlan.changes,
        ],
        timeline: [
          {
            step: 1,
            title: 'Incident Received',
            description: 'New telemetry event processed by crisis stream.',
            time: now,
            status: 'completed',
          },
          {
            step: 2,
            title: 'Incident Assessed',
            description: 'Constraint matrix re-weighted with latest road congestion data.',
            time: now,
            status: 'completed',
          },
          {
            step: 3,
            title: 'Resources Assigned',
            description: `PuLP optimizer generated updated allocation vector ${newPlanId}.`,
            time: now,
            status: 'completed',
          },
          {
            step: 4,
            title: 'Units Dispatched',
            description: 'Mobile dispatch notices transmitted to crew terminals.',
            time: now,
            status: 'completed',
          },
          {
            step: 5,
            title: 'Response Updated',
            description: 'Response Plan updated and activated across all tactical sectors.',
            time: now,
            status: 'active',
          },
        ],
      }

      setCurrentPlan(newPlan)
      setLoading(false)
      setToast({
        type: 'success',
        message: `Plan updated: Generated ${newPlanId} with revised fleet assignments.`,
      })
    }, 500)
  }

  // Incidents mapped to current plan
  const planIncidents = useMemo(() => {
    return (currentPlan.incident_ids || [])
      .map((id) => MOCK_INCIDENTS.find((i) => i.id === id))
      .filter(Boolean)
  }, [currentPlan])

  // Filtered assignments
  const filteredAssignments = useMemo(() => {
    if (assignmentFilter === 'all') return currentPlan.assignments || []
    return (currentPlan.assignments || []).filter((a) => a.resource_type === assignmentFilter)
  }, [currentPlan, assignmentFilter])

  // Summary counts
  const summary = useMemo(() => {
    const totalIncidents = (currentPlan.incident_ids || []).length
    const resourcesAssigned = (currentPlan.assignments || []).length
    const availableStandby = MOCK_RESOURCES.filter((r) => r.status === 'available').length
    const shortagesCount = (currentPlan.unassigned_incidents || []).length
    const avgEta = currentPlan.estimated_avg_eta || 5.8
    return { totalIncidents, resourcesAssigned, availableStandby, shortagesCount, avgEta }
  }, [currentPlan])

  const planSt = PLAN_STATUS[currentPlan.status] || PLAN_STATUS.active

  return (
    <div className="space-y-4">

      {/* ── Active Response Plan Master Header ── */}
      <div className="panel p-5 space-y-4 border-l-4" style={{ borderLeftColor: planSt.color }}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="mono text-xl font-black text-slate-900 tracking-wide">
                {currentPlan.plan_id}
              </span>
              <span
                className="badge text-xs font-bold px-3 py-1"
                style={{
                  color: planSt.color,
                  borderColor: `${planSt.color}40`,
                  background: `${planSt.color}15`,
                }}
              >
                {planSt.label}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-0.5 text-xs text-slate-700 font-semibold border border-slate-200">
                {currentPlan.priority}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Active Optimization Framework · Multi-Agency Urban Tactical Dispatch Plan
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsDetailsModalOpen(true)}
              className="btn text-xs py-2 px-3.5 hover:text-slate-900"
              title="Inspect optimization rationale & constraint details"
            >
              <span>📋</span>
              <span>View Details</span>
            </button>

            <button
              onClick={handleRefreshPlan}
              disabled={loading}
              className="btn text-xs py-2 px-3.5"
              title="Refresh telemetry"
            >
              <span className={loading ? 'animate-spin' : ''}>🔄</span>
              <span>Refresh Plan</span>
            </button>

            <button
              onClick={handleSimulateUpdate}
              disabled={loading}
              className="btn btn-primary text-xs py-2 px-4 shadow-sm"
              title="Simulate re-optimization with new telemetry"
            >
              <span>⚡</span>
              <span>Simulate Update</span>
            </button>
          </div>
        </div>

        {/* Plan Metadata Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-200 text-xs">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Created Time
            </span>
            <span className="mono text-slate-800 text-xs font-medium">
              {fmtDate(currentPlan.created_at)}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Last Recalculated
            </span>
            <span className="mono text-slate-800 text-xs font-medium">
              {timeSince(currentPlan.last_updated)} ({fmtTime(currentPlan.last_updated)})
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Optimization Status
            </span>
            <span className="text-emerald-700 font-semibold">
              ✓ {currentPlan.optimization_status}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Objective Value
            </span>
            <span className="mono text-sky-800 font-bold">
              {currentPlan.objective_value} pts (Optimal)
            </span>
          </div>
        </div>
      </div>

      {/* ── Summary Cards Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="stat-card" style={{ '--accent-color': '#0284c7' }}>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Total Incidents
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold mono text-slate-900">
              {summary.totalIncidents}
            </span>
            <span className="text-[11px] text-slate-500">in plan</span>
          </div>
        </div>

        <div className="stat-card" style={{ '--accent-color': '#16a34a' }}>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
            Resources Assigned
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold mono text-emerald-700">
              {summary.resourcesAssigned}
            </span>
            <span className="text-[11px] text-emerald-700/80">deployed units</span>
          </div>
        </div>

        <div className="stat-card" style={{ '--accent-color': '#7c3aed' }}>
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">
            Standby / Shortages
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold mono text-purple-700">
              {summary.availableStandby} free
            </span>
            {summary.shortagesCount > 0 && (
              <span className="text-[10px] text-red-600 font-bold">
                ({summary.shortagesCount} deficits)
              </span>
            )}
          </div>
        </div>

        <div className="stat-card" style={{ '--accent-color': '#ea580c' }}>
          <span className="text-[10px] font-bold uppercase tracking-wider text-orange-700">
            Estimated Response Time
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold mono text-orange-700">
              {summary.avgEta}m
            </span>
            <span className="text-[11px] text-orange-600/80">average ETA</span>
          </div>
        </div>
      </div>

      {/* ── Response-Plan Timeline Sequence ── */}
      <div className="panel p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-sky-600 text-base">⏱</span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Response-Plan Evolution Timeline
            </h3>
          </div>
          <span className="mono text-[10px] text-slate-500">
            Automated Incident Life Cycle
          </span>
        </div>

        {/* 5-Step Visual Timeline Process Bar */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2">
          {currentPlan.timeline?.map((item) => {
            const isDone = item.status === 'completed'
            const isActive = item.status === 'active'

            return (
              <div
                key={item.step}
                className={`relative rounded-xl border p-3 flex flex-col justify-between transition-all shadow-xs ${
                  isActive
                    ? 'border-sky-300 bg-sky-50 shadow-sm'
                    : isDone
                    ? 'border-slate-200 bg-slate-50'
                    : 'border-slate-200 bg-white opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold mono ${
                        isDone
                          ? 'bg-emerald-600 text-white'
                          : isActive
                          ? 'bg-sky-600 text-white animate-pulse'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {isDone ? '✓' : item.step}
                    </span>
                    <span className="mono text-[10px] text-slate-500">
                      {fmtTime(item.time)}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 mb-1">{item.title}</h4>
                  <p className="text-[11px] text-slate-600 leading-snug">{item.description}</p>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center justify-between text-[10px]">
                  <span className="text-slate-500 uppercase font-semibold">Step {item.step}/5</span>
                  <span
                    className={`font-semibold capitalize ${
                      isActive ? 'text-sky-800 font-bold' : isDone ? 'text-emerald-700' : 'text-slate-500'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Plan Changes & Reallocations Section ── */}
      <div className="panel p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-amber-600 text-base">⚡</span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Recent Plan Changes & Dynamic Reallocations
            </h3>
          </div>
          <span className="mono text-[10px] text-slate-500">
            {currentPlan.changes?.length || 0} updates logged
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {currentPlan.changes?.map((chg) => {
            const isReassigned = chg.type === 'reassigned'
            const isDispatched = chg.type === 'dispatched'
            const isAdded = chg.type === 'added'

            const badgeColor = isReassigned
              ? 'text-amber-800 bg-amber-50 border-amber-200'
              : isDispatched
              ? 'text-sky-800 bg-sky-50 border-sky-200'
              : 'text-emerald-800 bg-emerald-50 border-emerald-200'

            return (
              <div
                key={chg.id}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3"
              >
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase mono border flex-shrink-0 ${badgeColor}`}
                >
                  {chg.type}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 leading-snug">
                    {chg.description}
                  </p>
                  <span className="mono text-[10px] text-slate-500 mt-1 block">
                    Logged at {chg.time}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Incidents Included in Plan Table ── */}
      <div className="panel overflow-hidden">
        <div className="panel-title flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-red-600">🚨</span>
            <span className="text-slate-900 font-bold">Incidents Covered Under {currentPlan.plan_id}</span>
            <span className="mono rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700 font-bold">
              {planIncidents.length} active
            </span>
          </div>
          <span className="text-[10px] text-slate-500 normal-case hidden sm:inline">
            Ranked by priority score
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="w-24">Incident ID</th>
                <th>Type</th>
                <th className="w-24">Severity</th>
                <th>Location</th>
                <th className="w-24">Status</th>
                <th>Assigned Units</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {planIncidents.map((inc) => {
                const sev = SEVERITY[inc.severity] || SEVERITY.medium
                const isCrit = inc.severity === 'critical'
                const isWaiting = inc.status === 'waiting'
                const icon = INCIDENT_ICON[inc.type] || '⚠'

                return (
                  <tr key={inc.id} className="hover:bg-slate-50 transition-colors">
                    {/* ID */}
                    <td className="mono font-bold text-xs text-slate-900">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full flex-shrink-0 ${isCrit ? 'animate-flash' : ''}`}
                          style={{ background: sev.color }}
                        />
                        <span>{inc.id}</span>
                      </div>
                    </td>

                    {/* Type */}
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="text-base">{icon}</span>
                        <span className="text-xs font-semibold text-slate-800 capitalize">
                          {pretty(inc.type)}
                        </span>
                      </div>
                    </td>

                    {/* Severity */}
                    <td>
                      <span
                        className="badge text-[10px] font-bold"
                        style={{
                          color: sev.color,
                          borderColor: `${sev.color}35`,
                          background: `${sev.color}15`,
                        }}
                      >
                        {sev.label}
                      </span>
                    </td>

                    {/* Location */}
                    <td className="text-xs text-slate-700 font-medium">
                      📍 {inc.location_name}
                    </td>

                    {/* Status */}
                    <td>
                      <span
                        className={`badge text-[10px] font-bold ${isWaiting ? 'animate-flash' : ''}`}
                        style={
                          isWaiting
                            ? { color: '#7c3aed', borderColor: '#7c3aed35', background: '#7c3aed15' }
                            : { color: '#0284c7', borderColor: '#0284c735', background: '#0284c715' }
                        }
                      >
                        {isWaiting ? '⏳ Waiting' : 'Assigned'}
                      </span>
                    </td>

                    {/* Assigned units badges */}
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {inc.assigned_resources && inc.assigned_resources.length > 0 ? (
                          inc.assigned_resources.map((r) => (
                            <span
                              key={r}
                              className="mono text-[10px] font-bold text-sky-800 bg-sky-50 border border-sky-200 rounded px-1.5 py-0.5"
                            >
                              {r}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">None assigned</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Resource Assignments Table ── */}
      <div className="panel overflow-hidden">
        <div className="panel-title flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sky-600">🚒</span>
            <span className="text-slate-900 font-bold">Resource Allocations & Vector Routes</span>
            <span className="mono rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700 font-bold">
              {filteredAssignments.length} units
            </span>
          </div>

          {/* Filter by unit type */}
          <div className="flex items-center gap-1.5 text-xs normal-case ml-auto">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Filter:</span>
            {['all', 'fire_team', 'ambulance', 'rescue_team', 'medical_unit', 'shelter'].map((ft) => (
              <button
                key={ft}
                onClick={() => setAssignmentFilter(ft)}
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-all ${
                  assignmentFilter === ft
                    ? 'bg-sky-50 text-sky-800 border border-sky-200 font-bold shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {ft === 'all' ? 'All' : prettyCap(ft)}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="w-24">Resource ID</th>
                <th>Type</th>
                <th>Assigned Incident</th>
                <th>Status</th>
                <th className="w-24">ETA</th>
                <th>Rationale / Selection Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAssignments.map((asn) => {
                const icon = RESOURCE_ICON[asn.resource_type] || '🚚'
                const typeLabel =
                  RESOURCE_TYPE_LABELS[asn.resource_type] || prettyCap(asn.resource_type)
                const isUrgent = asn.eta <= 3

                return (
                  <tr key={asn.id} className="hover:bg-slate-50 transition-colors">
                    {/* Resource ID */}
                    <td className="mono font-bold text-xs text-slate-900">
                      <span className="rounded bg-slate-100 px-2 py-0.5 border border-slate-200">
                        {asn.resource_id}
                      </span>
                    </td>

                    {/* Type */}
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="text-base">{icon}</span>
                        <span className="text-xs font-semibold text-slate-800">
                          {typeLabel}
                        </span>
                      </div>
                    </td>

                    {/* Assigned Incident */}
                    <td>
                      <span className="mono text-xs font-bold text-sky-800 bg-sky-50 border border-sky-200 rounded px-2 py-0.5">
                        {asn.incident_id}
                      </span>
                    </td>

                    {/* Status */}
                    <td>
                      <span className="badge text-[10px] text-sky-800 border-sky-200 bg-sky-50 font-bold">
                        {asn.status === 'on_scene' ? '✓ On Scene' : asn.status}
                      </span>
                    </td>

                    {/* ETA */}
                    <td>
                      <span
                        className={`mono text-xs font-bold ${
                          isUrgent ? 'text-emerald-700' : 'text-slate-700'
                        }`}
                      >
                        {asn.eta} min{asn.eta === 1 ? '' : 's'}
                      </span>
                    </td>

                    {/* Rationale */}
                    <td className="text-xs text-slate-600 font-medium">
                      {asn.reason}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── View Details Modal ── */}
      {isDetailsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div
            className="absolute inset-0"
            onClick={() => setIsDetailsModalOpen(false)}
            aria-label="Close modal overlay"
          />

          <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden slide-up max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700 border border-sky-200 text-xl">
                  📋
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-wide">
                    Optimization Plan Details · {currentPlan.plan_id}
                  </h3>
                  <p className="mono text-[11px] text-slate-500 mt-0.5">
                    Linear Program Solver Diagnostics & Constraint Audit
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDetailsModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-slate-700 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              <div className="panel p-4 space-y-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Optimization Strategy & Rationale
                </h4>
                <p className="text-sm text-slate-800 leading-relaxed font-medium">
                  {currentPlan.explanation}
                </p>
              </div>

              {/* Solver Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">
                    Solver Engine
                  </span>
                  <span className="font-semibold text-slate-800 mt-1 block">PuLP + CBC</span>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">
                    Objective Score
                  </span>
                  <span className="mono font-bold text-sky-800 mt-1 block">
                    {currentPlan.objective_value}
                  </span>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">
                    Solve Time
                  </span>
                  <span className="mono font-bold text-emerald-700 mt-1 block">187 ms</span>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">
                    Constraints Met
                  </span>
                  <span className="mono font-bold text-slate-800 mt-1 block">34 / 36</span>
                </div>
              </div>

              {/* Shortage Flags */}
              {currentPlan.unassigned_incidents && (
                <div className="panel p-4 space-y-2 border-red-200 bg-red-50/50">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-red-700 flex items-center gap-2">
                    <span>⚠</span> Resource Shortage Constraints Flagged
                  </h4>
                  <div className="space-y-1.5 pt-1">
                    {currentPlan.unassigned_incidents.map((u, i) => (
                      <div
                        key={i}
                        className="flex items-start justify-between gap-2 p-2 rounded bg-white border border-red-200 text-xs"
                      >
                        <div>
                          <span className="mono font-bold text-slate-900 mr-2">
                            {u.incident_id}
                          </span>
                          <span className="text-slate-700 font-medium">{u.reason}</span>
                        </div>
                        <span className="badge text-[10px] text-red-700 border-red-200 bg-red-50 font-bold">
                          {u.missing_resources.join(', ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 bg-slate-50 px-6 py-3.5 flex items-center justify-end">
              <button
                onClick={() => setIsDetailsModalOpen(false)}
                className="btn px-4 py-2 text-xs"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Floating Toast Notification ── */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 slide-in">
          <div
            className="toast flex items-center gap-3 bg-white border border-slate-200 shadow-2xl rounded-xl p-3"
            style={{
              borderLeftColor: toast.type === 'success' ? '#16a34a' : '#0284c7',
              borderLeftWidth: '4px',
            }}
          >
            <span className="text-base">{toast.type === 'success' ? '✅' : 'ℹ️'}</span>
            <span className="text-xs font-semibold text-slate-800">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-slate-700 text-xs ml-2"
            >
              ✕
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
