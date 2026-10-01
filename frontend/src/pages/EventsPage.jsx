import { useState, useMemo } from 'react'
import { MOCK_EVENTS, MOCK_INCIDENTS, MOCK_RESOURCES } from '../data/mockData.js'
import { fmtTime, fmtDate, timeSince, pretty, prettyCap } from '../types/constants.js'

// Category configuration
const CATEGORIES = [
  { id: 'all',        label: 'All Categories', icon: '📜' },
  { id: 'incident',   label: 'Incidents',      icon: '📍' },
  { id: 'resource',   label: 'Resources',      icon: '🚒' },
  { id: 'allocation', label: 'Allocation',     icon: '⚡' },
  { id: 'dispatch',   label: 'Dispatch',       icon: '🚚' },
  { id: 'alert',      label: 'Alerts',         icon: '🚨' },
  { id: 'system',     label: 'System',         icon: '⚙️' },
]

// Visual style for event types
const EVENT_TYPE_STYLES = {
  HUMAN_APPROVAL_REQUIRED: { color: '#dc2626', icon: '👤', badge: 'bg-red-50 text-red-700 border-red-200 animate-flash' },
  PLAN_RECALCULATED:       { color: '#7c3aed', icon: '⟳',  badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  DISPATCH_CONFIRMED:      { color: '#0284c7', icon: '🚚', badge: 'bg-sky-50 text-sky-700 border-sky-200' },
  RESOURCE_ASSIGNED:       { color: '#16a34a', icon: '→',  badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  RESOURCE_UNAVAILABLE:    { color: '#dc2626', icon: '✗',  badge: 'bg-red-50 text-red-700 border-red-200' },
  INCIDENT_CREATED:        { color: '#ea580c', icon: '📍', badge: 'bg-orange-50 text-orange-700 border-orange-200' },
  INCIDENT_ASSESSED:       { color: '#d97706', icon: '🔍', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  SYSTEM_SYNC:             { color: '#475569', icon: '⚙️', badge: 'bg-slate-100 text-slate-700 border-slate-200' },
}

export default function EventsPage() {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedIncident, setSelectedIncident] = useState('all')
  const [selectedResource, setSelectedResource] = useState('all')
  const [timeFilter, setTimeFilter] = useState('all') // 'all' | '15m' | '1h' | '4h'
  const [expandedEvents, setExpandedEvents] = useState({})
  const [viewMode, setViewMode] = useState('timeline') // 'timeline' | 'table'

  // Toggle item expansion
  const toggleExpand = (id) => {
    setExpandedEvents((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // Expand all / Collapse all
  const toggleExpandAll = () => {
    const allExpanded = Object.keys(expandedEvents).length === filteredEvents.length &&
      Object.values(expandedEvents).every(Boolean)

    if (allExpanded) {
      setExpandedEvents({})
    } else {
      const next = {}
      filteredEvents.forEach((e) => { next[e.id] = true })
      setExpandedEvents(next)
    }
  }

  // Available unique Incidents and Resources for filter dropdowns
  const incidentOptions = useMemo(() => {
    const ids = Array.from(new Set(MOCK_EVENTS.map((e) => e.incident_id).filter(Boolean))).sort()
    return ids
  }, [])

  const resourceOptions = useMemo(() => {
    const ids = Array.from(new Set(MOCK_EVENTS.map((e) => e.resource_id).filter(Boolean))).sort()
    return ids
  }, [])

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return MOCK_EVENTS.filter((evt) => {
      // Search by description, incident_id, resource_id, actor
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchDesc = evt.description.toLowerCase().includes(q)
        const matchInc = (evt.incident_id || '').toLowerCase().includes(q)
        const matchRes = (evt.resource_id || '').toLowerCase().includes(q)
        const matchActor = (evt.actor || '').toLowerCase().includes(q)
        const matchType = evt.event_type.toLowerCase().includes(q)
        if (!matchDesc && !matchInc && !matchRes && !matchActor && !matchType) {
          return false
        }
      }

      // Category filter
      if (selectedCategory !== 'all' && evt.category !== selectedCategory) {
        return false
      }

      // Incident filter
      if (selectedIncident !== 'all' && evt.incident_id !== selectedIncident) {
        return false
      }

      // Resource filter
      if (selectedResource !== 'all' && evt.resource_id !== selectedResource) {
        return false
      }

      // Time filter (relative threshold simulation)
      if (timeFilter !== 'all') {
        const evtTime = new Date(evt.timestamp).getTime()
        const simRefTime = new Date('2026-09-30T13:43:00Z').getTime()
        const diffMinutes = (simRefTime - evtTime) / 60000
        if (timeFilter === '15m' && diffMinutes > 15) return false
        if (timeFilter === '1h' && diffMinutes > 60) return false
        if (timeFilter === '4h' && diffMinutes > 240) return false
      }

      return true
    })
  }, [search, selectedCategory, selectedIncident, selectedResource, timeFilter])

  // Summary counts for top cards
  const stats = useMemo(() => {
    const total = MOCK_EVENTS.length
    const alerts = MOCK_EVENTS.filter((e) => e.category === 'alert').length
    const dispatches = MOCK_EVENTS.filter((e) => e.category === 'dispatch').length
    const incidents = MOCK_EVENTS.filter((e) => e.category === 'incident').length
    const allocations = MOCK_EVENTS.filter((e) => e.category === 'allocation').length
    return { total, alerts, dispatches, incidents, allocations }
  }, [])

  const clearAllFilters = () => {
    setSearch('')
    setSelectedCategory('all')
    setSelectedIncident('all')
    setSelectedResource('all')
    setTimeFilter('all')
  }

  const hasActiveFilters =
    search || selectedCategory !== 'all' || selectedIncident !== 'all' || selectedResource !== 'all' || timeFilter !== 'all'

  return (
    <div className="space-y-4">

      {/* ── Latest Events Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="stat-card" style={{ '--accent-color': '#0284c7' }}>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Total Audit Events
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold mono text-slate-900">{stats.total}</span>
            <span className="text-[11px] text-slate-500">recorded</span>
          </div>
        </div>

        <div className="stat-card" style={{ '--accent-color': '#dc2626' }}>
          <span className="text-[10px] font-bold uppercase tracking-wider text-red-600">
            Alerts & Approvals
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold mono text-red-600 animate-flash">
              {stats.alerts}
            </span>
            <span className="text-[11px] text-red-600/80">urgent</span>
          </div>
        </div>

        <div className="stat-card" style={{ '--accent-color': '#0284c7' }}>
          <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700">
            Dispatches
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold mono text-sky-700">{stats.dispatches}</span>
            <span className="text-[11px] text-sky-600/80">movements</span>
          </div>
        </div>

        <div className="stat-card" style={{ '--accent-color': '#ea580c' }}>
          <span className="text-[10px] font-bold uppercase tracking-wider text-orange-700">
            Incidents Logged
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold mono text-orange-700">{stats.incidents}</span>
            <span className="text-[11px] text-orange-600/80">events</span>
          </div>
        </div>

        <div className="stat-card col-span-2 sm:col-span-1" style={{ '--accent-color': '#7c3aed' }}>
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">
            Plan Allocations
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold mono text-purple-700">{stats.allocations}</span>
            <span className="text-[11px] text-purple-600/80">solves</span>
          </div>
        </div>
      </div>

      {/* ── Category Filter Tabs ── */}
      <div className="panel p-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id
            const count =
              cat.id === 'all'
                ? MOCK_EVENTS.length
                : MOCK_EVENTS.filter((e) => e.category === cat.id).length

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-sky-50 text-sky-800 border border-sky-200 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
                <span
                  className={`mono text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    isSelected ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="panel p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
              🔍
            </span>
            <input
              type="text"
              placeholder="Search by event description, incident ID, resource, or actor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10 pr-9 text-xs"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 self-end lg:self-auto flex-wrap">
            {/* View Mode */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5">
              <button
                onClick={() => setViewMode('timeline')}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                  viewMode === 'timeline'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Vertical Timeline View"
              >
                ⏱ Timeline
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                  viewMode === 'table'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Tabular Audit Grid"
              >
                ☰ Table
              </button>
            </div>

            {/* Expand / Collapse All */}
            {viewMode === 'timeline' && (
              <button
                onClick={toggleExpandAll}
                className="btn text-xs py-1.5 px-3"
                title="Toggle all detail cards"
              >
                <span>↕</span>
                <span className="hidden sm:inline">Expand / Collapse All</span>
              </button>
            )}
          </div>
        </div>

        {/* Dropdowns and Time Filter Strip */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200 text-xs">
          
          {/* Incident Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Incident:
            </span>
            <select
              value={selectedIncident}
              onChange={(e) => setSelectedIncident(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 outline-none cursor-pointer focus:border-sky-500"
            >
              <option value="all">All Incidents</option>
              {incidentOptions.map((incId) => (
                <option key={incId} value={incId}>
                  {incId}
                </option>
              ))}
            </select>
          </div>

          {/* Resource Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Resource:
            </span>
            <select
              value={selectedResource}
              onChange={(e) => setSelectedResource(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 outline-none cursor-pointer focus:border-sky-500"
            >
              <option value="all">All Resources</option>
              {resourceOptions.map((resId) => (
                <option key={resId} value={resId}>
                  {resId}
                </option>
              ))}
            </select>
          </div>

          <div className="hidden md:block h-4 w-px bg-slate-200" />

          {/* Time range */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Time Range:
            </span>
            {[
              { id: 'all', label: 'All Time' },
              { id: '15m', label: 'Last 15m' },
              { id: '1h',  label: 'Last 1h' },
              { id: '4h',  label: 'Last 4h' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTimeFilter(t.id)}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-all ${
                  timeFilter === t.id
                    ? 'bg-sky-50 text-sky-800 border border-sky-200 shadow-xs'
                    : 'border border-slate-200 bg-white text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-[11px] text-red-600 hover:text-red-700 font-semibold underline underline-offset-2 ml-auto"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* ── Main Display: Visual Vertical Timeline or Table ── */}
      {filteredEvents.length === 0 ? (
        /* Empty State */
        <div className="panel p-12 text-center space-y-3">
          <div className="text-4xl">📜</div>
          <h3 className="text-sm font-bold text-slate-800">No Events Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No system audit events match your active search terms or filter constraints.
          </p>
          {hasActiveFilters && (
            <button onClick={clearAllFilters} className="btn btn-sim text-xs mt-2">
              Reset All Filters
            </button>
          )}
        </div>
      ) : viewMode === 'timeline' ? (
        /* ── VISUAL VERTICAL TIMELINE ── */
        <div className="panel p-5">
          <div className="space-y-6">
            {filteredEvents.map((evt) => {
              const typeCfg = EVENT_TYPE_STYLES[evt.event_type] || {
                color: '#64748b',
                icon: '·',
                badge: 'bg-slate-100 text-slate-700 border-slate-200',
              }
              const isExpanded = !!expandedEvents[evt.id]
              const isCrit = evt.severity === 'critical'

              return (
                <div key={evt.id} className="timeline-item">
                  {/* Timeline dot */}
                  <span
                    className="timeline-dot"
                    style={{
                      borderColor: typeCfg.color,
                      background: '#ffffff',
                      boxShadow: isCrit ? `0 0 8px ${typeCfg.color}60` : undefined,
                    }}
                  />

                  {/* Card Container */}
                  <div
                    className={`rounded-xl border transition-all shadow-xs ${
                      isCrit
                        ? 'border-red-200 bg-red-50/40 hover:border-red-300'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    {/* Header Row */}
                    <div
                      onClick={() => toggleExpand(evt.id)}
                      className="p-3.5 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {evt.id}
                        </span>
                        <span
                          className={`badge text-[10px] font-bold ${typeCfg.badge}`}
                        >
                          {typeCfg.icon} {pretty(evt.event_type)}
                        </span>
                        <span className="text-xs font-semibold text-slate-900">
                          {evt.description}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-auto flex-shrink-0">
                        <span className="mono text-[11px] text-slate-500">
                          {timeSince(evt.timestamp)} ({fmtTime(evt.timestamp)})
                        </span>
                        <span className="text-slate-400 text-xs">
                          {isExpanded ? '▲' : '▼'}
                        </span>
                      </div>
                    </div>

                    {/* Metadata chips row */}
                    <div className="px-3.5 pb-3 flex items-center gap-2 flex-wrap text-xs">
                      {evt.incident_id && (
                        <span className="mono text-[10px] font-bold text-orange-800 bg-orange-50 border border-orange-200 rounded px-2 py-0.5">
                          🚨 {evt.incident_id}
                        </span>
                      )}

                      {evt.resource_id && (
                        <span className="mono text-[10px] font-bold text-sky-800 bg-sky-50 border border-sky-200 rounded px-2 py-0.5">
                          🚒 {evt.resource_id}
                        </span>
                      )}

                      <span className="text-[11px] text-slate-500">
                        Actor: <strong className="text-slate-800">{evt.actor}</strong>
                      </span>

                      <span
                        className="ml-auto text-[10px] font-bold uppercase mono px-2 py-0.5 rounded border"
                        style={{
                          color: typeCfg.color,
                          borderColor: `${typeCfg.color}30`,
                          background: `${typeCfg.color}10`,
                        }}
                      >
                        {evt.status}
                      </span>
                    </div>

                    {/* Expandable State Transition Body */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/80 p-4 rounded-b-xl space-y-3 slide-up text-xs">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Full Event Description
                          </span>
                          <p className="text-slate-800 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-200">
                            {evt.description}
                          </p>
                        </div>

                        {/* State Transition Matrix */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="rounded-lg bg-white border border-slate-200 p-2.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                              Previous State
                            </span>
                            <span className="mono text-slate-700 block">
                              {evt.previous_state || 'Nominal / Unspecified'}
                            </span>
                          </div>

                          <div className="rounded-lg bg-sky-50 border border-sky-200 p-2.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800 block mb-1">
                              New State (Transition)
                            </span>
                            <span className="mono text-sky-900 font-semibold block">
                              {evt.new_state || 'Updated'}
                            </span>
                          </div>
                        </div>

                        {/* Actor & Timestamp Audit Bar */}
                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200">
                          <span>
                            Logged by:{' '}
                            <strong className="text-slate-800">{evt.actor}</strong>
                          </span>
                          <span className="mono text-slate-500">
                            UTC: {fmtDate(evt.timestamp)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* ── TABULAR AUDIT GRID VIEW ── */
        <div className="panel overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="w-24">Event ID</th>
                <th>Timestamp</th>
                <th>Category</th>
                <th>Event Type</th>
                <th>Description</th>
                <th>Incident</th>
                <th>Resource</th>
                <th>Actor</th>
                <th className="w-24">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEvents.map((evt) => {
                const typeCfg = EVENT_TYPE_STYLES[evt.event_type] || {
                  color: '#64748b',
                  badge: 'bg-slate-100 text-slate-700 border-slate-200',
                }
                const isCrit = evt.severity === 'critical'

                return (
                  <tr
                    key={evt.id}
                    className={`hover:bg-slate-50 transition-colors ${
                      isCrit ? 'bg-red-50/40' : ''
                    }`}
                  >
                    {/* ID */}
                    <td className="mono font-bold text-xs text-slate-900">
                      {evt.id}
                    </td>

                    {/* Timestamp */}
                    <td>
                      <div className="text-xs font-semibold text-slate-800">{fmtTime(evt.timestamp)}</div>
                      <div className="mono text-[10px] text-slate-500">
                        {timeSince(evt.timestamp)}
                      </div>
                    </td>

                    {/* Category */}
                    <td>
                      <span className="text-xs text-slate-700 capitalize font-medium">
                        {evt.category}
                      </span>
                    </td>

                    {/* Event Type */}
                    <td>
                      <span
                        className={`badge text-[9px] ${typeCfg.badge}`}
                      >
                        {pretty(evt.event_type)}
                      </span>
                    </td>

                    {/* Description */}
                    <td className="text-xs text-slate-700 max-w-sm">
                      <p className="truncate font-medium">{evt.description}</p>
                    </td>

                    {/* Incident */}
                    <td>
                      {evt.incident_id ? (
                        <span className="mono text-xs font-bold text-orange-800 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5">
                          {evt.incident_id}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Resource */}
                    <td>
                      {evt.resource_id ? (
                        <span className="mono text-xs font-bold text-sky-800 bg-sky-50 border border-sky-200 rounded px-1.5 py-0.5">
                          {evt.resource_id}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Actor */}
                    <td className="text-xs text-slate-600 font-medium">
                      {evt.actor}
                    </td>

                    {/* Status */}
                    <td>
                      <span
                        className="badge text-[9px] font-bold"
                        style={{
                          color: typeCfg.color,
                          borderColor: `${typeCfg.color}30`,
                          background: `${typeCfg.color}15`,
                        }}
                      >
                        {evt.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

    </div>
  )
}
