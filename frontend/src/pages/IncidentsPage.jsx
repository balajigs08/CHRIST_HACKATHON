import { useState, useMemo, useEffect } from 'react'
import { MOCK_INCIDENTS } from '../data/mockData.js'
import {
  SEVERITY,
  INCIDENT_STATUS,
  INCIDENT_ICON,
  pretty,
  prettyCap,
  fmtTime,
  timeSince,
} from '../types/constants.js'
import IncidentDetailPanel from '../components/IncidentDetailPanel.jsx'
import CreateIncidentModal from '../components/CreateIncidentModal.jsx'

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState(MOCK_INCIDENTS)
  const [search, setSearch] = useState('')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [viewMode, setViewMode] = useState('table') // 'table' | 'cards'
  const [selectedIncident, setSelectedIncident] = useState(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)

  // Auto-dismiss toast after 4s
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  // Simulated refresh
  const handleRefresh = () => {
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setToast({ type: 'info', message: 'Incident telemetry refreshed.' })
    }, 450)
  }

  // Handle new incident creation
  const handleCreateIncident = (newIncident) => {
    setIncidents((prev) => [newIncident, ...prev])
    setSelectedIncident(newIncident)
    setToast({
      type: 'success',
      message: `Incident ${newIncident.id} created and dispatched to triage queue.`,
    })
  }

  // Handle status toggle (resolve / re-open)
  const handleToggleStatus = (incidentId) => {
    setIncidents((prev) =>
      prev.map((inc) => {
        if (inc.id !== incidentId) return inc
        const isNowResolved = inc.status !== 'resolved'
        const updatedStatus = isNowResolved ? 'resolved' : 'waiting'
        const timelineEvent = {
          time: new Date().toISOString(),
          title: isNowResolved ? 'Incident Resolved' : 'Incident Re-opened',
          description: isNowResolved
            ? 'Incident marked as fully contained and resolved by Operator.'
            : 'Incident returned to active waiting queue for additional response.',
          actor: 'Operator (Frontend)',
        }
        const updatedInc = {
          ...inc,
          status: updatedStatus,
          timeline: [timelineEvent, ...(inc.timeline || [])],
        }
        if (selectedIncident && selectedIncident.id === incidentId) {
          setSelectedIncident(updatedInc)
        }
        return updatedInc
      })
    )

    setToast({
      type: 'info',
      message: `Status updated for ${incidentId}.`,
    })
  }

  // Unique types from the current dataset
  const availableTypes = useMemo(() => {
    const types = new Set(incidents.map((i) => i.type))
    return Array.from(types).sort()
  }, [incidents])

  // Filtered incidents
  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      // Search filter (id, type, location_name, description)
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchesId = inc.id.toLowerCase().includes(q)
        const matchesType = inc.type.toLowerCase().includes(q)
        const matchesLoc = (inc.location_name || '').toLowerCase().includes(q)
        const matchesDesc = (inc.description || '').toLowerCase().includes(q)
        if (!matchesId && !matchesType && !matchesLoc && !matchesDesc) {
          return false
        }
      }

      // Severity filter
      if (severityFilter !== 'all' && inc.severity !== severityFilter) {
        return false
      }

      // Status filter
      if (statusFilter !== 'all' && inc.status !== statusFilter) {
        return false
      }

      // Type filter
      if (typeFilter !== 'all' && inc.type !== typeFilter) {
        return false
      }

      return true
    })
  }, [incidents, search, severityFilter, statusFilter, typeFilter])

  // Counts for KPI strip
  const stats = useMemo(() => {
    const total = incidents.length
    const critical = incidents.filter((i) => i.severity === 'critical' && i.status !== 'resolved').length
    const high = incidents.filter((i) => i.severity === 'high' && i.status !== 'resolved').length
    const waiting = incidents.filter((i) => i.status === 'waiting').length
    const resolved = incidents.filter((i) => i.status === 'resolved').length
    return { total, critical, high, waiting, resolved }
  }, [incidents])

  const clearAllFilters = () => {
    setSearch('')
    setSeverityFilter('all')
    setStatusFilter('all')
    setTypeFilter('all')
  }

  const hasActiveFilters = search || severityFilter !== 'all' || statusFilter !== 'all' || typeFilter !== 'all'

  return (
    <div className="space-y-4">
      
      {/* ── KPI Summary Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="stat-card" style={{ '--accent-color': '#0ea5e9' }}>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Incidents</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold mono text-slate-900">{stats.total}</span>
            <span className="text-[11px] text-slate-500 font-medium">registered</span>
          </div>
        </div>

        <div className="stat-card" style={{ '--accent-color': '#ef4444' }}>
          <span className="text-[10px] font-bold uppercase tracking-wider text-red-600">Critical Active</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold mono text-red-700 animate-flash">{stats.critical}</span>
            <span className="text-[11px] text-red-600 font-medium">urgent</span>
          </div>
        </div>

        <div className="stat-card" style={{ '--accent-color': '#f97316' }}>
          <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600">High Priority</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold mono text-orange-700">{stats.high}</span>
            <span className="text-[11px] text-orange-600 font-medium">monitored</span>
          </div>
        </div>

        <div className="stat-card" style={{ '--accent-color': '#c084fc' }}>
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">Awaiting Units</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold mono text-purple-700">{stats.waiting}</span>
            <span className="text-[11px] text-purple-600 font-medium">in queue</span>
          </div>
        </div>

        <div className="stat-card col-span-2 sm:col-span-1" style={{ '--accent-color': '#22c55e' }}>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Resolved</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold mono text-emerald-700">{stats.resolved}</span>
            <span className="text-[11px] text-emerald-600 font-medium">contained</span>
          </div>
        </div>
      </div>

      {/* ── Toolbar: Search, Filters, Actions ── */}
      <div className="panel p-4 space-y-3 bg-white border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
              🔍
            </span>
            <input
              type="text"
              placeholder="Search by ID, type, location or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10 pr-9 text-xs bg-white"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 self-end lg:self-auto flex-wrap">
            {/* View Mode Switcher */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              <button
                onClick={() => setViewMode('table')}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                  viewMode === 'table'
                    ? 'bg-sky-100 text-sky-700 border border-sky-300'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Table View"
              >
                ☰ Table
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                  viewMode === 'cards'
                    ? 'bg-sky-100 text-sky-700 border border-sky-300'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Grid Cards View"
              >
                ⊞ Cards
              </button>
            </div>

            {/* Refresh */}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="btn bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium"
              title="Refresh telemetry"
            >
              <span className={loading ? 'animate-spin' : ''}>🔄</span>
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Authority Triage Telemetry Indicator */}
            <div className="hidden sm:flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-1 text-xs text-sky-700 font-mono font-medium">
              <span className="h-2 w-2 rounded-full bg-sky-600 animate-pulse" />
              INCOMING INTAKE STREAM
            </div>
          </div>
        </div>


        {/* Filter Chips Bar */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200 text-xs">
          
          {/* Severity Filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">Severity:</span>
            {['all', 'critical', 'high', 'medium', 'low'].map((s) => {
              const active = severityFilter === s
              const sColor = s !== 'all' ? SEVERITY[s]?.color : undefined
              return (
                <button
                  key={s}
                  onClick={() => setSeverityFilter(s)}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize transition-all ${
                    active
                      ? 'border shadow-2xs font-bold'
                      : 'border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                  style={
                    active
                      ? sColor
                        ? { color: sColor, borderColor: `${sColor}60`, background: `${sColor}18` }
                        : { color: '#0284c7', borderColor: '#0284c7', background: 'rgba(2,132,199,0.1)' }
                      : {}
                  }
                >
                  {s}
                </button>
              )
            })}
          </div>

          <div className="hidden md:block h-4 w-px bg-slate-200" />

          {/* Status Filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">Status:</span>
            {['all', 'assigned', 'waiting', 'resolved'].map((st) => {
              const active = statusFilter === st
              return (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize transition-all ${
                    active
                      ? 'bg-sky-100 text-sky-700 border border-sky-300 font-bold'
                      : 'border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {st}
                </button>
              )
            })}
          </div>

          <div className="hidden md:block h-4 w-px bg-slate-200" />

          {/* Incident Type dropdown */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 outline-none cursor-pointer shadow-2xs font-medium"
            >
              <option value="all">All Types ({availableTypes.length})</option>
              {availableTypes.map((t) => (
                <option key={t} value={t}>
                  {INCIDENT_ICON[t] || '⚠'} {prettyCap(t)}
                </option>
              ))}
            </select>

            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-[11px] text-red-600 hover:text-red-800 font-semibold underline underline-offset-2 ml-1"
              >
                Reset filters
              </button>
            )}
          </div>
        </div>

      </div>

      {/* ── Main Display: Table or Cards ── */}
      {loading ? (
        <LoadingSkeleton viewMode={viewMode} />
      ) : filteredIncidents.length === 0 ? (
        <div className="panel p-12 text-center space-y-3 bg-white border-slate-200">
          <div className="text-4xl">📡</div>
          <h3 className="text-sm font-bold text-slate-800">No Incidents Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No incidents matched your current search parameters or active filters.
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="btn btn-sim text-xs mt-2"
            >
              Reset All Filters
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* ── TABLE VIEW ── */
        <div className="panel overflow-x-auto bg-white border-slate-200">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="w-24">Incident ID</th>
                <th>Type</th>
                <th>Location</th>
                <th className="w-24">Severity</th>
                <th className="w-24">Status</th>
                <th>Reported</th>
                <th>Required Resources</th>
                <th className="text-right pr-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredIncidents.map((inc) => {
                const sev = SEVERITY[inc.severity] || SEVERITY.medium
                const st = INCIDENT_STATUS[inc.status] || {
                  label: prettyCap(inc.status),
                  color: '#64748b',
                }
                const icon = INCIDENT_ICON[inc.type] || INCIDENT_ICON.default
                const isCrit = inc.severity === 'critical'
                const isWaiting = inc.status === 'waiting'
                const isSelected = selectedIncident?.id === inc.id

                return (
                  <tr
                    key={inc.id}
                    onClick={() => setSelectedIncident(inc)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-sky-50/80'
                        : isCrit
                        ? 'hover:bg-red-50/50 bg-red-50/30'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* ID */}
                    <td className="mono font-bold text-xs text-slate-900">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full flex-shrink-0 ${isCrit ? 'animate-flash' : ''}`}
                          style={{
                            background: sev.color,
                            boxShadow: isCrit ? `0 0 6px ${sev.color}` : undefined,
                          }}
                        />
                        <span>{inc.id}</span>
                      </div>
                    </td>

                    {/* Type */}
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{icon}</span>
                        <span className="text-xs font-semibold text-slate-800 capitalize">
                          {pretty(inc.type)}
                        </span>
                      </div>
                    </td>

                    {/* Location */}
                    <td>
                      <div className="max-w-xs">
                        <p className="text-xs font-medium text-slate-800 truncate">{inc.location_name}</p>
                        <p className="mono text-[10px] text-slate-500 truncate mt-0.5">
                          {inc.latitude ? `${inc.latitude.toFixed(3)}, ${inc.longitude.toFixed(3)}` : 'Grid Alpha'}
                        </p>
                      </div>
                    </td>

                    {/* Severity */}
                    <td>
                      <span
                        className="badge font-semibold"
                        style={{
                          color: sev.color,
                          borderColor: `${sev.color}45`,
                          background: `${sev.color}15`,
                        }}
                      >
                        {sev.label}
                      </span>
                    </td>

                    {/* Status */}
                    <td>
                      <span
                        className={`badge font-semibold ${isWaiting ? 'animate-flash' : ''}`}
                        style={{
                          color: st.color,
                          borderColor: `${st.color}45`,
                          background: `${st.color}15`,
                        }}
                      >
                        {isWaiting && '⏳ '}
                        {st.label}
                      </span>
                    </td>

                    {/* Reported */}
                    <td>
                      <div className="text-xs font-medium text-slate-700">{timeSince(inc.created_at)}</div>
                      <div className="mono text-[10px] text-slate-500">{fmtTime(inc.created_at)}</div>
                    </td>

                    {/* Required Resources */}
                    <td>
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {inc.required_resources?.map((r) => {
                          const isMissing = inc.missing_resources?.includes(r)
                          return (
                            <span
                              key={r}
                              className="badge text-[9px] px-2 py-0.5 font-medium"
                              style={
                                isMissing
                                  ? {
                                      color: '#b91c1c',
                                      borderColor: 'rgba(239,68,68,0.4)',
                                      background: 'rgba(254,242,242,1)',
                                    }
                                  : {
                                      color: '#15803d',
                                      borderColor: 'rgba(34,197,94,0.35)',
                                      background: 'rgba(240,253,244,1)',
                                    }
                              }
                            >
                              {isMissing ? '✕ ' : '✓ '}
                              {pretty(r)}
                            </span>
                          )
                        })}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="text-right pr-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedIncident(inc)
                        }}
                        className="btn bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-[11px] py-1 px-2.5 font-medium shadow-2xs"
                      >
                        View Details →
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* ── CARDS VIEW ── */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredIncidents.map((inc) => {
            const sev = SEVERITY[inc.severity] || SEVERITY.medium
            const st = INCIDENT_STATUS[inc.status] || {
              label: prettyCap(inc.status),
              color: '#64748b',
            }
            const icon = INCIDENT_ICON[inc.type] || INCIDENT_ICON.default
            const isCrit = inc.severity === 'critical'
            const isWaiting = inc.status === 'waiting'
            const isSelected = selectedIncident?.id === inc.id

            return (
              <div
                key={inc.id}
                onClick={() => setSelectedIncident(inc)}
                className={`panel p-4 cursor-pointer transition-all flex flex-col justify-between bg-white border-slate-200 shadow-2xs ${
                  isSelected
                    ? 'border-sky-400 ring-2 ring-sky-200'
                    : isCrit
                    ? 'border-red-200 hover:border-red-300'
                    : 'hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-base border border-slate-200">
                        {icon}
                      </span>
                      <div>
                        <span className="mono text-xs font-bold text-slate-900">{inc.id}</span>
                        <p className="text-[11px] text-slate-500 capitalize font-medium">{pretty(inc.type)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className="badge text-[10px] font-semibold"
                        style={{
                          color: sev.color,
                          borderColor: `${sev.color}45`,
                          background: `${sev.color}15`,
                        }}
                      >
                        {sev.label}
                      </span>
                      <span
                        className={`badge text-[10px] font-semibold ${isWaiting ? 'animate-flash' : ''}`}
                        style={{
                          color: st.color,
                          borderColor: `${st.color}45`,
                          background: `${st.color}15`,
                        }}
                      >
                        {isWaiting && '⏳ '}
                        {st.label}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-700 line-clamp-2 mb-3 leading-relaxed font-normal">
                    {inc.description}
                  </p>

                  {/* Location & Reported */}
                  <div className="space-y-1 text-xs text-slate-600 mb-3 bg-slate-50 rounded-lg p-2.5 border border-slate-200">
                    <div className="flex items-center gap-1.5 truncate font-medium">
                      <span>📍</span>
                      <span className="truncate">{inc.location_name}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                      <span>Reported {timeSince(inc.created_at)}</span>
                      <span>Waiting {Math.round(inc.waiting_time)}m</span>
                    </div>
                  </div>

                  {/* Required Resources badges */}
                  <div className="mb-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                      Required Fleet:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {inc.required_resources?.map((r) => {
                        const isMissing = inc.missing_resources?.includes(r)
                        return (
                          <span
                            key={r}
                            className="badge text-[9px] font-medium"
                            style={
                              isMissing
                                ? {
                                    color: '#b91c1c',
                                    borderColor: 'rgba(239,68,68,0.4)',
                                    background: 'rgba(254,242,242,1)',
                                  }
                                : {
                                    color: '#15803d',
                                    borderColor: 'rgba(34,197,94,0.35)',
                                    background: 'rgba(240,253,244,1)',
                                  }
                            }
                          >
                            {isMissing ? '✕ ' : '✓ '}
                            {pretty(r)}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                    <span>Priority:</span>
                    <span className="mono font-bold text-slate-800">{inc.urgency}/10</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedIncident(inc)
                    }}
                    className="btn bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs py-1 px-3 font-medium shadow-2xs"
                  >
                    View Details →
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Slide-over Details Panel ── */}
      <IncidentDetailPanel
        incident={selectedIncident}
        onClose={() => setSelectedIncident(null)}
        onToggleStatus={handleToggleStatus}
      />

      {/* ── Create Incident Modal ── */}
      <CreateIncidentModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreateIncident}
      />

      {/* ── Toast Notification ── */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 slide-in">
          <div
            className="toast flex items-center gap-3 bg-white border border-slate-200 shadow-xl rounded-xl p-3"
            style={{
              borderLeftWidth: '4px',
              borderLeftColor: toast.type === 'success' ? '#16a34a' : '#0284c7',
            }}
          >
            <span className="text-base">
              {toast.type === 'success' ? '✅' : 'ℹ️'}
            </span>
            <span className="text-xs font-semibold text-slate-800">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-slate-700 text-xs ml-2 font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

/* ── Loading Skeleton component ── */
function LoadingSkeleton({ viewMode }) {
  if (viewMode === 'cards') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="panel p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="skeleton h-8 w-28" />
              <div className="skeleton h-5 w-16" />
            </div>
            <div className="skeleton h-10 w-full" />
            <div className="skeleton h-12 w-full" />
            <div className="skeleton h-6 w-3/4" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="panel p-4 space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="skeleton h-12 w-full rounded-lg" />
      ))}
    </div>
  )
}
