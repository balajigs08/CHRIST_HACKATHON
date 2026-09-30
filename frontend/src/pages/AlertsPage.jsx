import { useState, useMemo } from 'react'
import { MOCK_ALERTS, MOCK_APPROVALS, MOCK_INCIDENTS, MOCK_RESOURCES } from '../data/mockData.js'
import { fmtTime, timeSince, pretty, prettyCap } from '../types/constants.js'

export default function AlertsPage({ onNavigate }) {
  // Local state for approvals (frontend mock mutations)
  const [approvals, setApprovals] = useState(MOCK_APPROVALS)
  const [alerts, setAlerts] = useState(MOCK_ALERTS)
  const [selectedAlertId, setSelectedAlertId] = useState(MOCK_ALERTS[0]?.id || null)

  // Filter state for Approvals
  const [approvalFilter, setApprovalFilter] = useState('all') // 'all' | 'pending' | 'approved' | 'rejected'

  // Filter state for Alerts
  const [search, setSearch] = useState('')
  const [severityFilter, setSeverityFilter] = useState('all') // 'all' | 'critical' | 'warning' | 'informational'
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'active' | 'acknowledged' | 'resolved'

  // Toast feedback
  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  // ── Approval actions ──
  const handleApprove = (id) => {
    const item = approvals.find((a) => a.id === id)
    setApprovals((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'approved', resolved_at: new Date().toISOString() } : a))
    )
    showToast(`✓ Request ${id} APPROVED: "${item?.title}" authorized by Commander.`, 'success')
  }

  const handleReject = (id) => {
    const item = approvals.find((a) => a.id === id)
    setApprovals((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'rejected', resolved_at: new Date().toISOString() } : a))
    )
    showToast(`✗ Request ${id} REJECTED: "${item?.title}" dismissed by Commander.`, 'error')
  }

  const handleReopen = (id) => {
    setApprovals((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'pending', resolved_at: null } : a))
    )
    showToast(`⟳ Request ${id} reopened to Pending state.`, 'info')
  }

  // ── Alert status actions ──
  const handleAcknowledgeAlert = (id) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'acknowledged' } : a))
    )
    showToast(`Alert ${id} acknowledged by operator.`, 'info')
  }

  const handleResolveAlert = (id) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'resolved' } : a))
    )
    showToast(`Alert ${id} marked as RESOLVED.`, 'success')
  }

  // ── Computed Summary Metrics ──
  const metrics = useMemo(() => {
    const criticalCount = alerts.filter((a) => a.severity === 'critical').length
    const warningCount = alerts.filter((a) => a.severity === 'warning').length
    const infoCount = alerts.filter((a) => a.severity === 'informational').length
    const humanAttentionCount = alerts.filter((a) => a.requires_human_attention && a.status !== 'resolved').length
    const pendingApprovalsCount = approvals.filter((a) => a.status === 'pending').length

    return {
      critical: criticalCount,
      warning: warningCount,
      informational: infoCount,
      humanAttention: humanAttentionCount,
      pendingApprovals: pendingApprovalsCount,
    }
  }, [alerts, approvals])

  // ── Filtered Approvals ──
  const filteredApprovals = useMemo(() => {
    if (approvalFilter === 'all') return approvals
    return approvals.filter((a) => a.status === approvalFilter)
  }, [approvals, approvalFilter])

  // ── Filtered Alerts ──
  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      // Free text search
      if (search) {
        const q = search.toLowerCase()
        const match =
          a.id.toLowerCase().includes(q) ||
          a.title.toLowerCase().includes(q) ||
          a.description?.toLowerCase().includes(q) ||
          a.related_incident?.toLowerCase().includes(q) ||
          a.related_resource?.toLowerCase().includes(q) ||
          a.trigger_event?.toLowerCase().includes(q)
        if (!match) return false
      }

      // Severity
      if (severityFilter !== 'all' && a.severity !== severityFilter) return false

      // Alert Type
      if (typeFilter !== 'all' && a.alert_type !== typeFilter) return false

      // Status
      if (statusFilter !== 'all' && a.status !== statusFilter) return false

      return true
    })
  }, [alerts, search, severityFilter, typeFilter, statusFilter])

  // Selected Alert object
  const selectedAlert = alerts.find((a) => a.id === selectedAlertId) || filteredAlerts[0] || null

  // Alert types unique list
  const alertTypes = useMemo(() => {
    return Array.from(new Set(MOCK_ALERTS.map((a) => a.alert_type))).sort()
  }, [])

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* ── Floating Toast Feedback ── */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border px-5 py-3.5 shadow-2xl backdrop-blur-xl animate-fade-in ${
            toast.type === 'success'
              ? 'border-emerald-500/40 bg-slate-950/90 text-emerald-300 shadow-emerald-950/30'
              : toast.type === 'error'
              ? 'border-red-500/40 bg-slate-950/90 text-red-300 shadow-red-950/30'
              : 'border-sky-500/40 bg-slate-950/90 text-sky-300 shadow-sky-950/30'
          }`}
        >
          <span className="text-xl">
            {toast.type === 'success' ? '✅' : toast.type === 'error' ? '🚫' : 'ℹ️'}
          </span>
          <span className="text-sm font-semibold text-white">{toast.message}</span>
        </div>
      )}

      {/* ── Top Page Header ── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b border-edge/60 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="badge border border-red-500/40 bg-red-500/10 text-red-300 font-mono text-xs">
              🚨 TACTICAL ALERTS &amp; AUTHORIZATION
            </span>
            <span className="text-xs text-slate-500 font-mono">Phase 9 UI</span>
            <span className="text-slate-600">·</span>
            <span className="text-xs text-slate-400">Supervisor Station 01</span>
          </div>
          <h1 className="text-xl lg:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <span>Human Approval &amp; Alert Center</span>
          </h1>
          <p className="text-xs lg:text-sm text-slate-400 mt-1 max-w-3xl">
            Review real-time system alerts, critical threshold breaches, and authorize or reject automated emergency reallocations and dispatch overrides.
          </p>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-2.5">
          {metrics.pendingApprovals > 0 ? (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/15 px-3.5 py-2 text-xs font-bold text-red-300 animate-flash">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400 animate-ping" />
              <span>{metrics.pendingApprovals} APPROVAL{metrics.pendingApprovals > 1 ? 'S' : ''} PENDING</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-300">
              <span>✓ All Approvals Resolved</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Section 1: Alert Summary Cards (Requirement 2) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* 1. Critical Alerts */}
        <div className="panel p-4 border-red-500/30 bg-gradient-to-br from-red-950/20 via-surface to-surface relative overflow-hidden group">
          <div className="flex items-center justify-between text-red-400 text-xs font-bold uppercase tracking-wider">
            <span>Critical Alerts</span>
            <span className="text-lg">🔥</span>
          </div>
          <div className="mt-2 text-3xl font-black text-white tracking-tight flex items-baseline gap-2">
            <span>{metrics.critical}</span>
            <span className="text-xs font-mono text-red-400">high priority</span>
          </div>
          <div className="mt-1 text-[11px] text-red-300/80">
            Immediate life-safety or resource deficit
          </div>
        </div>

        {/* 2. Warning Alerts */}
        <div className="panel p-4 border-amber-500/30 bg-gradient-to-br from-amber-950/20 via-surface to-surface relative overflow-hidden group">
          <div className="flex items-center justify-between text-amber-400 text-xs font-bold uppercase tracking-wider">
            <span>Warning Alerts</span>
            <span className="text-lg">⚠️</span>
          </div>
          <div className="mt-2 text-3xl font-black text-white tracking-tight flex items-baseline gap-2">
            <span>{metrics.warning}</span>
            <span className="text-xs font-mono text-amber-400">threshold</span>
          </div>
          <div className="mt-1 text-[11px] text-amber-300/80">
            Telemetry spikes &amp; route traffic delays
          </div>
        </div>

        {/* 3. Informational Alerts */}
        <div className="panel p-4 border-slate-700/60 bg-gradient-to-br from-slate-900/40 via-surface to-surface relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Informational</span>
            <span className="text-lg">ℹ️</span>
          </div>
          <div className="mt-2 text-3xl font-black text-white tracking-tight flex items-baseline gap-2">
            <span>{metrics.informational}</span>
            <span className="text-xs font-mono text-slate-400">telemetry</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Solver runs &amp; base channel sync events
          </div>
        </div>

        {/* 4. Requires Human Attention */}
        <div className={`panel p-4 relative overflow-hidden group ${metrics.humanAttention > 0 ? 'border-red-500/50 bg-gradient-to-br from-red-950/30 to-surface animate-pulse' : 'border-emerald-500/30 bg-surface'}`}>
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
            <span className={metrics.humanAttention > 0 ? 'text-red-400' : 'text-emerald-400'}>
              Human Attention
            </span>
            <span className="text-lg">{metrics.humanAttention > 0 ? '👤' : '🛡️'}</span>
          </div>
          <div className="mt-2 text-3xl font-black text-white tracking-tight flex items-baseline gap-2">
            <span className={metrics.humanAttention > 0 ? 'text-red-300' : 'text-emerald-300'}>
              {metrics.humanAttention}
            </span>
            <span className="text-xs font-mono text-slate-400">unresolved</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-300">
            {metrics.humanAttention > 0 ? 'Requires supervisor decision' : 'All critical alerts handled'}
          </div>
        </div>
      </div>

      {/* ── Section 2: "Human Approval Required" (Requirements 6, 7, 8, 9) ── */}
      <div className="panel p-4 lg:p-6 space-y-5 border-l-4 border-l-red-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-edge/60 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-500 animate-ping" />
              <h2 className="text-lg font-black text-white tracking-wide uppercase">
                Human Approval Required
              </h2>
              <span className="badge bg-red-500/20 text-red-300 border-red-500/40 text-xs font-mono font-bold">
                {approvals.filter((a) => a.status === 'pending').length} Pending
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Autonomous constraint overrides requiring manual Commander sign-off before field execution.
            </p>
          </div>

          {/* Approval Filter Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-edge">
            {[
              { id: 'all', label: 'All', count: approvals.length },
              { id: 'pending', label: 'Pending', count: approvals.filter((a) => a.status === 'pending').length },
              { id: 'approved', label: 'Approved', count: approvals.filter((a) => a.status === 'approved').length },
              { id: 'rejected', label: 'Rejected', count: approvals.filter((a) => a.status === 'rejected').length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setApprovalFilter(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  approvalFilter === tab.id
                    ? 'bg-slate-800 text-sky-300 border border-sky-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <span>{tab.label}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800/80 font-mono">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Approval Cards Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filteredApprovals.length === 0 ? (
            <div className="col-span-full py-8 text-center text-slate-500 text-xs font-mono">
              No approval requests match the current filter.
            </div>
          ) : (
            filteredApprovals.map((req) => {
              const isPending = req.status === 'pending'
              const isApproved = req.status === 'approved'
              const isRejected = req.status === 'rejected'

              return (
                <div
                  key={req.id}
                  className={`rounded-2xl border p-4 lg:p-5 transition-all space-y-3.5 relative overflow-hidden ${
                    isPending
                      ? 'border-red-500/40 bg-gradient-to-br from-red-950/15 via-surface to-surface shadow-lg shadow-red-950/10'
                      : isApproved
                      ? 'border-emerald-500/30 bg-surface/50 opacity-90'
                      : 'border-slate-800 bg-surface/30 opacity-70'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-edge/60 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-black text-sky-400 bg-slate-900 px-2 py-0.5 rounded border border-edge">
                          {req.id}
                        </span>
                        <span className="badge text-[11px] font-bold bg-purple-500/15 text-purple-300 border-purple-500/30">
                          {prettyCap(req.type)}
                        </span>
                        <span className={`badge text-[10px] font-bold ${req.priority === 'critical' ? 'bg-red-500/20 text-red-300 border-red-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'}`}>
                          {req.priority.toUpperCase()}
                        </span>
                      </div>
                      <h3 className="text-sm lg:text-base font-bold text-white mt-1">
                        {req.title}
                      </h3>
                    </div>

                    {/* Status Badge */}
                    <div>
                      {isPending && (
                        <span className="badge bg-amber-500/15 text-amber-300 border-amber-500/40 text-xs font-bold animate-pulse">
                          ⏳ PENDING DECISION
                        </span>
                      )}
                      {isApproved && (
                        <span className="badge bg-emerald-500/15 text-emerald-300 border-emerald-500/40 text-xs font-bold">
                          ✓ APPROVED
                        </span>
                      )}
                      {isRejected && (
                        <span className="badge bg-red-500/15 text-red-300 border-red-500/40 text-xs font-bold">
                          ✗ REJECTED
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Request Details */}
                  <p className="text-xs text-slate-200 leading-relaxed font-medium">
                    {req.details}
                  </p>

                  {/* 3 Detail Blocks: Reason, Impact, Action */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
                    <div className="rounded-xl border border-red-500/20 bg-red-500/05 p-2.5 space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-red-400">
                        Shortage / Reason
                      </div>
                      <p className="text-[11px] text-slate-300 leading-snug">
                        {req.reason}
                      </p>
                    </div>

                    <div className="rounded-xl border border-sky-500/20 bg-sky-500/05 p-2.5 space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                        Operational Impact
                      </div>
                      <p className="text-[11px] text-slate-300 leading-snug">
                        {req.impact}
                      </p>
                    </div>

                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/05 p-2.5 space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                        Recommended Action
                      </div>
                      <p className="text-[11px] text-slate-300 leading-snug">
                        {req.recommended_action}
                      </p>
                    </div>
                  </div>

                  {/* Related Entities & Requester */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 pt-2 border-t border-edge/40">
                    <div className="flex items-center gap-2 flex-wrap font-mono">
                      <span>Incident: <strong className="text-slate-200">{req.incident_id}</strong></span>
                      <span className="text-slate-600">·</span>
                      <span>Resource: <strong className="text-slate-200">{req.resource_id}</strong></span>
                      <span className="text-slate-600">·</span>
                      <span>{fmtTime(req.created_at)}</span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Via {req.requested_by}
                    </div>
                  </div>

                  {/* Actions: Approve / Reject Buttons (Requirement 7) */}
                  <div className="pt-2 flex items-center justify-end gap-2.5">
                    {isPending ? (
                      <>
                        <button
                          onClick={() => handleReject(req.id)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-300 font-bold text-xs transition-all shadow-sm shadow-red-950/20"
                        >
                          <span>✗ Reject</span>
                        </button>
                        <button
                          onClick={() => handleApprove(req.id)}
                          className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs transition-all shadow-lg shadow-emerald-950/30"
                        >
                          <span>✓ Approve Request</span>
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-mono">
                          {isApproved ? 'Approved by Supervisor' : 'Rejected by Supervisor'}
                        </span>
                        <button
                          onClick={() => handleReopen(req.id)}
                          className="text-[11px] text-sky-400 hover:text-sky-300 underline font-mono"
                        >
                          Reopen
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── Section 3: All System Alerts (Requirements 3, 4, 5) ── */}
      <div className="space-y-4">
        {/* Section Header & Filters Toolbar */}
        <div className="panel p-4 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-edge/60 pb-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>📋</span> Chronological System Alerts ({filteredAlerts.length})
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Automated exception stream from hardware sensors, road telemetry, and solver constraints
              </p>
            </div>

            {/* Severity Filter Pills */}
            <div className="flex items-center gap-1 flex-wrap">
              {['all', 'critical', 'warning', 'informational'].map((sev) => (
                <button
                  key={sev}
                  onClick={() => setSeverityFilter(sev)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                    severityFilter === sev
                      ? sev === 'critical'
                        ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                        : sev === 'warning'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-slate-800 text-sky-300 border border-sky-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          {/* Search & Dropdown Filters Bar (Requirement 4) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
            {/* Free text search */}
            <div>
              <input
                type="text"
                placeholder="Search alerts, incidents, resources..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-edge bg-slate-900/80 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/30"
              />
            </div>

            {/* Alert Type filter */}
            <div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full rounded-xl border border-edge bg-slate-900/80 px-3 py-2 text-xs text-slate-200 focus:border-sky-500/50 focus:outline-none"
              >
                <option value="all">All Alert Types</option>
                {alertTypes.map((t) => (
                  <option key={t} value={t}>
                    {prettyCap(t)}
                  </option>
                ))}
              </select>
            </div>

            {/* Status filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-xl border border-edge bg-slate-900/80 px-3 py-2 text-xs text-slate-200 focus:border-sky-500/50 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>

            {/* Reset Filters */}
            <div className="flex items-center">
              <button
                onClick={() => {
                  setSearch('')
                  setSeverityFilter('all')
                  setTypeFilter('all')
                  setStatusFilter('all')
                }}
                className="w-full rounded-xl border border-edge bg-surface/60 hover:bg-surface px-3 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all text-center"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        {/* ── Main Layout: Alert List + Selected Alert Details Panel ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Alert List Table / Cards (Requirement 3) */}
          <div className="lg:col-span-7 space-y-2.5">
            {filteredAlerts.length === 0 ? (
              <div className="panel p-10 text-center space-y-3">
                <span className="text-3xl">🔍</span>
                <h4 className="text-sm font-bold text-slate-300">No alerts match your filter criteria</h4>
                <p className="text-xs text-slate-500">
                  Try adjusting the severity, type, or search term above.
                </p>
                <button
                  onClick={() => {
                    setSearch('')
                    setSeverityFilter('all')
                    setTypeFilter('all')
                    setStatusFilter('all')
                  }}
                  className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-1.5 text-xs font-semibold text-sky-300 hover:bg-sky-500/20"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              filteredAlerts.map((alt) => {
                const isSelected = selectedAlert?.id === alt.id
                const isCritical = alt.severity === 'critical'
                const isWarning = alt.severity === 'warning'

                return (
                  <div
                    key={alt.id}
                    onClick={() => setSelectedAlertId(alt.id)}
                    className={`cursor-pointer rounded-2xl border p-3.5 transition-all space-y-2 relative ${
                      isSelected
                        ? 'border-sky-500/50 bg-slate-900/90 shadow-md shadow-sky-500/10'
                        : 'border-edge bg-surface/60 hover:border-slate-600 hover:bg-surface/90'
                    }`}
                  >
                    {/* Top Row: ID, Severity, Status, Time */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-sky-400 bg-slate-900 px-1.5 py-0.5 rounded border border-edge">
                          {alt.id}
                        </span>
                        <span
                          className={`badge text-[10px] font-bold ${
                            isCritical
                              ? 'bg-red-500/20 text-red-300 border-red-500/40'
                              : isWarning
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-slate-800 text-slate-300 border-edge'
                          }`}
                        >
                          {alt.severity.toUpperCase()}
                        </span>
                        {alt.requires_human_attention && alt.status !== 'resolved' && (
                          <span className="badge text-[10px] bg-red-500/15 text-red-400 border-red-500/30 font-bold animate-pulse">
                            Needs Action
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-slate-400">
                          {fmtTime(alt.time)}
                        </span>
                        <span className={`badge text-[10px] font-semibold ${alt.status === 'active' ? 'bg-sky-500/15 text-sky-300 border-sky-500/30' : alt.status === 'acknowledged' ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'}`}>
                          {prettyCap(alt.status)}
                        </span>
                      </div>
                    </div>

                    {/* Title */}
                    <h4 className="text-sm font-bold text-white leading-snug">
                      {alt.title}
                    </h4>

                    {/* Metadata: Incident ID, Resource ID */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono">
                      {alt.related_incident && (
                        <span className="rounded bg-slate-800/80 px-2 py-0.5 text-[11px] text-slate-300 border border-edge">
                          📍 {alt.related_incident}
                        </span>
                      )}
                      {alt.related_resource && (
                        <span className="rounded bg-slate-800/80 px-2 py-0.5 text-[11px] text-slate-300 border border-edge">
                          🚒 {alt.related_resource}
                        </span>
                      )}
                      <span className="text-slate-500 text-[11px]">
                        Type: {prettyCap(alt.alert_type)}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Right Column: Alert Details Panel (Requirement 5) */}
          <div className="lg:col-span-5">
            {selectedAlert ? (
              <div className="panel p-5 sticky top-16 space-y-4 border-slate-700/80 bg-surface/95 backdrop-blur-xl">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 border-b border-edge/60 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-sky-400">
                        {selectedAlert.id}
                      </span>
                      <span
                        className={`badge text-[10px] font-bold ${
                          selectedAlert.severity === 'critical'
                            ? 'bg-red-500/20 text-red-300 border-red-500/40'
                            : selectedAlert.severity === 'warning'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-slate-800 text-slate-300 border-edge'
                        }`}
                      >
                        {selectedAlert.severity.toUpperCase()}
                      </span>
                      <span className="badge text-[10px] bg-slate-800 text-slate-400 border-edge font-mono">
                        {prettyCap(selectedAlert.alert_type)}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white mt-1.5 leading-snug">
                      {selectedAlert.title}
                    </h3>
                  </div>

                  <span className={`badge text-xs font-bold ${selectedAlert.status === 'active' ? 'bg-sky-500/15 text-sky-300 border-sky-500/30' : selectedAlert.status === 'acknowledged' ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'}`}>
                    {prettyCap(selectedAlert.status)}
                  </span>
                </div>

                {/* 1. Alert Description */}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Alert Description
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-edge/60">
                    {selectedAlert.description}
                  </p>
                </div>

                {/* 2. Trigger / Event */}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-1 flex items-center gap-1">
                    <span>⚡</span> Trigger Event &amp; Sensor Telemetry
                  </div>
                  <div className="text-xs text-slate-300 font-mono bg-amber-500/05 border border-amber-500/20 p-2.5 rounded-xl">
                    {selectedAlert.trigger_event}
                  </div>
                </div>

                {/* 3. Affected Incident & Resource */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl border border-edge bg-surface/50 p-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Affected Incident
                    </div>
                    <div className="text-xs font-semibold text-sky-300 mt-1">
                      {selectedAlert.affected_incident || 'N/A (Fleet / System)'}
                    </div>
                  </div>

                  <div className="rounded-xl border border-edge bg-surface/50 p-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Affected Resource
                    </div>
                    <div className="text-xs font-semibold text-emerald-300 mt-1">
                      {selectedAlert.affected_resource || 'N/A (Multi-unit)'}
                    </div>
                  </div>
                </div>

                {/* 4. Recommended Action */}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1 flex items-center gap-1">
                    <span>💡</span> Recommended Operational Action
                  </div>
                  <div className="text-xs text-emerald-200 bg-emerald-500/08 border border-emerald-500/20 p-3 rounded-xl leading-relaxed">
                    {selectedAlert.recommended_action}
                  </div>
                </div>

                {/* 5. Created Time */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-edge/60 pt-3 font-mono">
                  <span>Timestamp: {fmtTime(selectedAlert.created_time || selectedAlert.time)}</span>
                  <span>({timeSince(selectedAlert.created_time || selectedAlert.time)})</span>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-2">
                  {selectedAlert.status !== 'acknowledged' && selectedAlert.status !== 'resolved' && (
                    <button
                      onClick={() => handleAcknowledgeAlert(selectedAlert.id)}
                      className="flex-1 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-2 text-xs font-bold text-amber-300 transition-all text-center"
                    >
                      Acknowledge Alert
                    </button>
                  )}
                  {selectedAlert.status !== 'resolved' && (
                    <button
                      onClick={() => handleResolveAlert(selectedAlert.id)}
                      className="flex-1 rounded-xl border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 px-3 py-2 text-xs font-bold text-emerald-300 transition-all text-center"
                    >
                      Mark as Resolved
                    </button>
                  )}
                  {selectedAlert.status === 'resolved' && (
                    <div className="w-full text-center text-xs text-emerald-400 font-semibold py-1">
                      ✓ This alert has been resolved.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="panel p-8 text-center text-slate-500 text-xs font-mono">
                Select an alert from the list to view comprehensive diagnostic details.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
