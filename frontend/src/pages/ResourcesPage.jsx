import { useState, useMemo, useEffect } from 'react'
import { MOCK_RESOURCES } from '../data/mockData.js'
import {
  RESOURCE_STATUS,
  RESOURCE_ICON,
  RESOURCE_TYPE_LABELS,
  pretty,
  prettyCap,
  fmtTime,
  timeSince,
} from '../types/constants.js'
import ResourceDetailPanel from '../components/ResourceDetailPanel.jsx'

const CATEGORY_TABS = [
  { id: 'all',          label: 'All Fleets',    icon: '🏢' },
  { id: 'ambulance',    label: 'Ambulances',    icon: '🚑' },
  { id: 'fire_team',    label: 'Fire Units',    icon: '🚒' },
  { id: 'police_unit',  label: 'Police Units',  icon: '🚓' },
  { id: 'rescue_team',  label: 'Rescue Teams',  icon: '🪖' },
  { id: 'medical_unit', label: 'Medical Teams', icon: '🏥' },
  { id: 'shelter',      label: 'Shelter Hubs',  icon: '⛺' },
]

export default function ResourcesPage() {
  const [resources, setResources] = useState(MOCK_RESOURCES)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [availabilityFilter, setAvailabilityFilter] = useState('all') // 'all' | 'available' | 'deployed' | 'offline'
  const [viewMode, setViewMode] = useState('table') // 'table' | 'cards'
  const [selectedResource, setSelectedResource] = useState(null)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(timer)
  }, [toast])

  // Simulated refresh
  const handleRefresh = () => {
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setToast({ type: 'info', message: 'Fleet telemetry synced with GPS satellites.' })
    }, 400)
  }

  // Update resource status in state
  const handleStatusChange = (resourceId, newStatus) => {
    setResources((prev) =>
      prev.map((r) => {
        if (r.id !== resourceId) return r
        const updated = {
          ...r,
          status: newStatus,
          current_assignment: newStatus === 'assigned' ? (r.current_assignment || 'INC001') : null,
          availability:
            newStatus === 'available'
              ? 'Available Now'
              : newStatus === 'assigned'
              ? 'Deployed (Manual Override)'
              : newStatus === 'maintenance'
              ? 'Maintenance (Scheduled)'
              : 'Offline (Out of Service)',
          last_updated: new Date().toISOString(),
          activity_log: [
            {
              time: new Date().toISOString(),
              title: `Status set to ${newStatus.toUpperCase()}`,
              description: `Operational status manually altered by Command Center Operator.`,
            },
            ...(r.activity_log || []),
          ],
        }
        if (selectedResource && selectedResource.id === resourceId) {
          setSelectedResource(updated)
        }
        return updated
      })
    )
    setToast({
      type: 'success',
      message: `Unit ${resourceId} status changed to ${newStatus}.`,
    })
  }

  // Filtered resources
  const filteredResources = useMemo(() => {
    return resources.filter((res) => {
      // Search by ID, type, location_name, callsign
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchId = res.id.toLowerCase().includes(q)
        const matchType = res.type.toLowerCase().includes(q)
        const matchLoc = (res.location_name || '').toLowerCase().includes(q)
        const matchCall = (res.callsign || '').toLowerCase().includes(q)
        const matchBase = (res.base_station || '').toLowerCase().includes(q)
        const matchInc = (res.current_assignment || '').toLowerCase().includes(q)
        if (!matchId && !matchType && !matchLoc && !matchCall && !matchBase && !matchInc) {
          return false
        }
      }

      // Category / Type filter
      if (categoryFilter !== 'all' && res.type !== categoryFilter) {
        return false
      }

      // Status filter
      if (statusFilter !== 'all' && res.status !== statusFilter) {
        return false
      }

      // Availability filter
      if (availabilityFilter !== 'all') {
        if (availabilityFilter === 'available' && res.status !== 'available') return false
        if (availabilityFilter === 'deployed' && res.status !== 'assigned') return false
        if (availabilityFilter === 'offline' && res.status !== 'unavailable' && res.status !== 'maintenance') {
          return false
        }
      }

      return true
    })
  }, [resources, search, categoryFilter, statusFilter, availabilityFilter])

  // Summary counts for cards
  const stats = useMemo(() => {
    const total = resources.length
    const available = resources.filter((r) => r.status === 'available').length
    const assigned = resources.filter((r) => r.status === 'assigned').length
    const unavailable = resources.filter((r) => r.status === 'unavailable').length
    const maintenance = resources.filter((r) => r.status === 'maintenance').length
    return { total, available, assigned, unavailable, maintenance }
  }, [resources])

  const clearAllFilters = () => {
    setSearch('')
    setCategoryFilter('all')
    setStatusFilter('all')
    setAvailabilityFilter('all')
  }

  const hasActiveFilters =
    search || categoryFilter !== 'all' || statusFilter !== 'all' || availabilityFilter !== 'all'

  return (
    <div className="space-y-4">

      {/* ── Summary KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="stat-card" style={{ '--accent-color': '#0ea5e9' }}>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Resources</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold mono text-white">{stats.total}</span>
            <span className="text-[11px] text-slate-500">fleet units</span>
          </div>
        </div>

        <div className="stat-card" style={{ '--accent-color': '#22c55e' }}>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Available</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold mono text-emerald-400">{stats.available}</span>
            <span className="text-[11px] text-emerald-500/80">ready</span>
          </div>
        </div>

        <div className="stat-card" style={{ '--accent-color': '#3b82f6' }}>
          <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">Assigned</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold mono text-sky-400">{stats.assigned}</span>
            <span className="text-[11px] text-sky-500/80">deployed</span>
          </div>
        </div>

        <div className="stat-card" style={{ '--accent-color': '#ef4444' }}>
          <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">Unavailable</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold mono text-red-400">{stats.unavailable}</span>
            <span className="text-[11px] text-red-500/80">offline</span>
          </div>
        </div>

        <div className="stat-card col-span-2 sm:col-span-1" style={{ '--accent-color': '#a855f7' }}>
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">Maintenance</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold mono text-purple-400">{stats.maintenance}</span>
            <span className="text-[11px] text-purple-400/80">service</span>
          </div>
        </div>
      </div>

      {/* ── Resource Category Tabs ── */}
      <div className="panel p-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {CATEGORY_TABS.map((tab) => {
            const isSelected = categoryFilter === tab.id
            const count =
              tab.id === 'all'
                ? resources.length
                : resources.filter((r) => r.type === tab.id).length

            return (
              <button
                key={tab.id}
                onClick={() => setCategoryFilter(tab.id)}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-sky-500/15 text-sky-300 border border-sky-500/35 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-panel2/60 border border-transparent'
                }`}
              >
                <span className="text-sm">{tab.icon}</span>
                <span>{tab.label}</span>
                <span
                  className={`mono text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected
                      ? 'bg-sky-500/25 text-sky-200'
                      : 'bg-edge text-slate-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Toolbar: Search, Filters, and Layout Mode ── */}
      <div className="panel p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
              🔍
            </span>
            <input
              type="text"
              placeholder="Search by ID, callsign, type, location or assigned incident..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10 pr-9 text-xs"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 self-end lg:self-auto">
            {/* View Mode Switcher */}
            <div className="flex items-center rounded-lg border border-edge bg-panel2 p-0.5">
              <button
                onClick={() => setViewMode('table')}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                  viewMode === 'table'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
                title="Table View"
              >
                ☰ Table
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                  viewMode === 'cards'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
                title="Cards View"
              >
                ⊞ Cards
              </button>
            </div>

            {/* Refresh */}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="btn text-xs"
              title="Refresh telemetry"
            >
              <span className={loading ? 'animate-spin' : ''}>🔄</span>
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Filter Chips Bar */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-edge text-xs">
          
          {/* Status Filter buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">Status:</span>
            {['all', 'available', 'assigned', 'unavailable', 'maintenance'].map((st) => {
              const active = statusFilter === st
              const stConf = st !== 'all' ? RESOURCE_STATUS[st] : null
              return (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize transition-all ${
                    active
                      ? 'border shadow-sm'
                      : 'border border-edge bg-panel2/40 text-slate-500 hover:text-slate-300'
                  }`}
                  style={
                    active
                      ? stConf
                        ? { color: stConf.color, borderColor: `${stConf.color}60`, background: `${stConf.color}18` }
                        : { color: '#38bdf8', borderColor: '#38bdf860', background: 'rgba(56,189,248,0.15)' }
                      : {}
                  }
                >
                  {st}
                </button>
              )
            })}
          </div>

          <div className="hidden md:block h-4 w-px bg-edge" />

          {/* Availability filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">Availability:</span>
            {[
              { id: 'all',       label: 'All' },
              { id: 'available', label: 'Available Now' },
              { id: 'deployed',  label: 'In Field / Deployed' },
              { id: 'offline',   label: 'Down / Inactive' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setAvailabilityFilter(f.id)}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-all ${
                  availabilityFilter === f.id
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                    : 'border border-edge bg-panel2/40 text-slate-500 hover:text-slate-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-[11px] text-red-400 hover:text-red-300 underline underline-offset-2 ml-auto"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* ── Main Display: Table or Cards ── */}
      {loading ? (
        <LoadingSkeleton viewMode={viewMode} />
      ) : filteredResources.length === 0 ? (
        <div className="panel p-12 text-center space-y-3">
          <div className="text-4xl">🚚</div>
          <h3 className="text-sm font-bold text-slate-300">No Fleet Units Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No resources match the specified search term or selected filter combinations.
          </p>
          {hasActiveFilters && (
            <button onClick={clearAllFilters} className="btn btn-sim text-xs mt-2">
              Reset All Filters
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* ── TABLE VIEW ── */
        <div className="panel overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="w-24">Resource ID</th>
                <th>Type</th>
                <th>Location / Base</th>
                <th className="w-28">Status</th>
                <th>Assigned Incident</th>
                <th>Availability</th>
                <th>Last Updated</th>
                <th className="text-right pr-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/50">
              {filteredResources.map((res) => {
                const icon = RESOURCE_ICON[res.type] || '🚚'
                const typeLabel = RESOURCE_TYPE_LABELS[res.type] || prettyCap(res.type)
                const st = RESOURCE_STATUS[res.status] || {
                  label: prettyCap(res.status),
                  color: '#94a3b8',
                }
                const isSelected = selectedResource?.id === res.id

                return (
                  <tr
                    key={res.id}
                    onClick={() => setSelectedResource(res)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-sky-500/10'
                        : res.status === 'unavailable'
                        ? 'hover:bg-red-500/5 bg-red-500/2'
                        : 'hover:bg-panel2/60'
                    }`}
                  >
                    {/* ID */}
                    <td className="mono font-bold text-xs text-white">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full flex-shrink-0"
                          style={{
                            background: st.color,
                            boxShadow: `0 0 5px ${st.color}`,
                          }}
                        />
                        <span>{res.id}</span>
                      </div>
                    </td>

                    {/* Type */}
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{icon}</span>
                        <div>
                          <p className="text-xs font-semibold text-slate-200">{typeLabel}</p>
                          <p className="mono text-[10px] text-slate-500">{res.callsign || 'UNIT'}</p>
                        </div>
                      </div>
                    </td>

                    {/* Location */}
                    <td>
                      <div className="max-w-xs">
                        <p className="text-xs text-slate-200 truncate flex items-center gap-1">
                          <span>📍</span>
                          <span>{res.location_name}</span>
                        </p>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">
                          Base: {res.base_station || 'Central Depot'}
                        </p>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td>
                      <span
                        className="badge text-[10px]"
                        style={{
                          color: st.color,
                          borderColor: `${st.color}45`,
                          background: `${st.color}15`,
                        }}
                      >
                        {st.label}
                      </span>
                    </td>

                    {/* Assigned Incident */}
                    <td>
                      {res.current_assignment ? (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/35 bg-sky-500/15 px-2.5 py-0.5 text-xs font-bold text-sky-200 mono">
                          <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
                          {res.current_assignment}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500 italic">None (Standby)</span>
                      )}
                    </td>

                    {/* Availability */}
                    <td>
                      <div className="text-xs text-slate-300 font-medium">{res.availability}</div>
                      {res.eta && (
                        <span className="mono text-[10px] text-sky-400">ETA: {res.eta} mins</span>
                      )}
                    </td>

                    {/* Last Updated */}
                    <td>
                      <div className="text-xs text-slate-300">{timeSince(res.last_updated)}</div>
                      <div className="mono text-[10px] text-slate-500">{fmtTime(res.last_updated)}</div>
                    </td>

                    {/* Actions */}
                    <td className="text-right pr-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedResource(res)
                        }}
                        className="btn text-[11px] py-1 px-2.5 hover:text-white"
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
          {filteredResources.map((res) => {
            const icon = RESOURCE_ICON[res.type] || '🚚'
            const typeLabel = RESOURCE_TYPE_LABELS[res.type] || prettyCap(res.type)
            const st = RESOURCE_STATUS[res.status] || {
              label: prettyCap(res.status),
              color: '#94a3b8',
            }
            const isSelected = selectedResource?.id === res.id

            return (
              <div
                key={res.id}
                onClick={() => setSelectedResource(res)}
                className={`panel p-4 cursor-pointer transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'border-sky-500/60 ring-1 ring-sky-500/30'
                    : 'hover:border-edge-2'
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-edge/70 text-lg border border-edge-2">
                        {icon}
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="mono text-xs font-bold text-white">{res.id}</span>
                          <span className="text-[10px] font-semibold text-slate-400 mono">
                            [{res.callsign || 'UNIT'}]
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 capitalize">{typeLabel}</p>
                      </div>
                    </div>

                    <span
                      className="badge text-[10px]"
                      style={{
                        color: st.color,
                        borderColor: `${st.color}45`,
                        background: `${st.color}15`,
                      }}
                    >
                      {st.label}
                    </span>
                  </div>

                  {/* Location & Status Info */}
                  <div className="space-y-1.5 text-xs text-slate-400 mb-3 bg-panel2/50 rounded-lg p-2.5 border border-edge/60">
                    <div className="flex items-center gap-1.5 truncate">
                      <span>📍</span>
                      <span className="truncate text-slate-200">{res.location_name}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-edge/40">
                      <span>Base: {res.base_station || 'Main Base'}</span>
                      <span className="mono text-slate-500">Updated {timeSince(res.last_updated)}</span>
                    </div>
                  </div>

                  {/* Assignment and Availability */}
                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div className="rounded-lg bg-panel2/40 border border-edge p-2">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 block">
                        Assignment
                      </span>
                      {res.current_assignment ? (
                        <span className="mono font-bold text-sky-300 text-xs">
                          🚨 {res.current_assignment}
                        </span>
                      ) : (
                        <span className="text-slate-500 italic text-[11px]">Standby</span>
                      )}
                    </div>
                    <div className="rounded-lg bg-panel2/40 border border-edge p-2">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 block">
                        Readiness
                      </span>
                      <span className="font-semibold text-slate-200 text-[11px] truncate block">
                        {res.availability}
                      </span>
                    </div>
                  </div>

                  {/* Capabilities snippet */}
                  {res.capabilities && res.capabilities.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {res.capabilities.slice(0, 2).map((cap, i) => (
                        <span key={i} className="badge text-[9px] border-edge bg-panel2 text-slate-400">
                          {cap}
                        </span>
                      ))}
                      {res.capabilities.length > 2 && (
                        <span className="text-[9px] text-slate-500 self-center">
                          +{res.capabilities.length - 2} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Footer */}
                <div className="pt-3 border-t border-edge flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">
                    Crew: <strong className="text-slate-300 mono">{res.crew_size}</strong>
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedResource(res)
                    }}
                    className="btn text-xs py-1 px-3 hover:text-white"
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
      <ResourceDetailPanel
        resource={selectedResource}
        onClose={() => setSelectedResource(null)}
        onStatusChange={handleStatusChange}
      />

      {/* ── Toast Notification ── */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 slide-in">
          <div
            className="toast flex items-center gap-3 bg-panel border-edge shadow-2xl"
            style={{
              borderLeftColor: toast.type === 'success' ? '#22c55e' : '#38bdf8',
            }}
          >
            <span className="text-base">
              {toast.type === 'success' ? '✅' : 'ℹ️'}
            </span>
            <span className="text-xs text-slate-200">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="text-slate-500 hover:text-white text-xs ml-2"
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
