import { useState, useMemo, useRef } from 'react'
import { MOCK_INCIDENTS, MOCK_RESOURCES, MOCK_APPROVALS, MOCK_SIM_TIME } from '../data/mockData.js'
import {
  SEVERITY,
  RESOURCE_STATUS,
  RESOURCE_ICON,
  INCIDENT_ICON,
  RESOURCE_TYPE_LABELS,
  pretty,
  prettyCap,
  fmtTime,
  timeSince,
} from '../types/constants.js'

// Map canvas dimensions
const W = 960
const H = 600
const PAD = 60

export default function LiveMapPage() {
  // Zoom & Pan state
  const [zoom, setZoom] = useState(1.0)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0 })

  // Filters state
  const [showIncidents, setShowIncidents] = useState(true)
  const [showResources, setShowResources] = useState(true)
  const [filterCritical, setFilterCritical] = useState(true)
  const [filterHigh, setFilterHigh] = useState(true)
  const [filterAvailable, setFilterAvailable] = useState(true)
  const [filterAssigned, setFilterAssigned] = useState(true)

  // Selection state (can be an incident or a resource)
  const [selectedEntity, setSelectedEntity] = useState(() => {
    // Default select INC001 for instant rich preview
    return { type: 'incident', data: MOCK_INCIDENTS[0] }
  })
  const [legendOpen, setLegendOpen] = useState(true)
  const [mobilePanelOpen, setMobilePanelOpen] = useState(true)

  // Compute coordinate bounding box
  const allPts = useMemo(() => [...MOCK_INCIDENTS, ...MOCK_RESOURCES], [])
  const lats = allPts.map((p) => p.latitude)
  const lons = allPts.map((p) => p.longitude)
  const minLat = Math.min(...lats) - 0.025
  const maxLat = Math.max(...lats) + 0.025
  const minLon = Math.min(...lons) - 0.025
  const maxLon = Math.max(...lons) + 0.025

  // Coordinate projections
  const px = (lon) => PAD + ((lon - minLon) / (maxLon - minLon)) * (W - 2 * PAD)
  const py = (lat) => H - PAD - ((lat - minLat) / (maxLat - minLat)) * (H - 2 * PAD)

  const posMap = useMemo(() => {
    return Object.fromEntries(
      allPts.map((p) => [p.id, [px(p.longitude), py(p.latitude)]])
    )
  }, [allPts, minLat, maxLat, minLon, maxLon])

  // Filtered incidents
  const visibleIncidents = useMemo(() => {
    if (!showIncidents) return []
    return MOCK_INCIDENTS.filter((inc) => {
      if (inc.status === 'resolved') return false
      if (inc.severity === 'critical' && !filterCritical) return false
      if (inc.severity === 'high' && !filterHigh) return false
      return true
    })
  }, [showIncidents, filterCritical, filterHigh])

  // Filtered resources
  const visibleResources = useMemo(() => {
    if (!showResources) return []
    return MOCK_RESOURCES.filter((res) => {
      if (res.status === 'available' && !filterAvailable) return false
      if (res.status === 'assigned' && !filterAssigned) return false
      return true
    })
  }, [showResources, filterAvailable, filterAssigned])

  // Assignment vector lines
  const visibleAssignments = useMemo(() => {
    const list = []
    visibleIncidents.forEach((inc) => {
      ;(inc.assigned_resources || []).forEach((rid) => {
        const res = MOCK_RESOURCES.find((r) => r.id === rid)
        if (res && (showResources ? visibleResources.some((vr) => vr.id === rid) : true)) {
          list.push({ inc, res })
        }
      })
    })
    return list
  }, [visibleIncidents, visibleResources, showResources])

  // Top Status Bar KPIs
  const stats = useMemo(() => {
    const activeIncidents = MOCK_INCIDENTS.filter((i) => i.status !== 'resolved').length
    const resourcesDeployed = MOCK_RESOURCES.filter((r) => r.status === 'assigned').length
    const criticalAlerts = MOCK_APPROVALS.filter((a) => a.status === 'pending').length
    return { activeIncidents, resourcesDeployed, criticalAlerts }
  }, [])

  // Map Controls Handlers
  const handleZoomIn = () => setZoom((z) => Math.min(Number((z + 0.25).toFixed(2)), 2.5))
  const handleZoomOut = () => setZoom((z) => Math.max(Number((z - 0.25).toFixed(2)), 0.75))
  const handleResetView = () => {
    setZoom(1.0)
    setPan({ x: 0, y: 0 })
  }
  const handleCenter = () => {
    if (selectedEntity) {
      const p = posMap[selectedEntity.data.id]
      if (p) {
        setPan({
          x: (W / 2 - p[0]) * zoom,
          y: (H / 2 - p[1]) * zoom,
        })
        return
      }
    }
    setPan({ x: 0, y: 0 })
  }

  // Mouse pan handlers
  const handleMouseDown = (e) => {
    setIsDragging(true)
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
  }

  const handleMouseMove = (e) => {
    if (!isDragging) return
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    })
  }

  const handleMouseUp = () => setIsDragging(false)

  // Selection handlers
  const handleSelectIncident = (inc) => {
    setSelectedEntity({ type: 'incident', data: inc })
    setMobilePanelOpen(true)
  }

  const handleSelectResource = (res) => {
    setSelectedEntity({ type: 'resource', data: res })
    setMobilePanelOpen(true)
  }

  return (
    <div className="space-y-3">

      {/* ── Top Status Bar ── */}
      <div className="panel px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 bg-panel/90 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="mono text-xs font-bold text-white tracking-wider uppercase">
              Tactical Grid · Bengaluru Central Command
            </span>
          </div>
          <span className="text-slate-700 hidden sm:inline">|</span>
          <span className="mono text-[11px] text-slate-400 hidden sm:inline">
            Telemetry Time: {fmtTime(MOCK_SIM_TIME)}
          </span>
        </div>

        {/* Status Counters */}
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 rounded-lg border border-edge bg-panel2/60 px-2.5 py-1 text-xs">
            <span className="text-orange-400 text-sm">⚠</span>
            <span className="text-slate-400">Active Incidents:</span>
            <span className="mono font-bold text-white">{stats.activeIncidents}</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-edge bg-panel2/60 px-2.5 py-1 text-xs">
            <span className="text-sky-400 text-sm">🚒</span>
            <span className="text-slate-400">Deployed Fleet:</span>
            <span className="mono font-bold text-sky-300">{stats.resourcesDeployed}</span>
          </div>

          {stats.criticalAlerts > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs text-red-300 animate-flash">
              <span>🚨</span>
              <span className="font-semibold">Critical Approvals:</span>
              <span className="mono font-bold">{stats.criticalAlerts}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Filter Controls Strip ── */}
      <div className="panel px-4 py-2 flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">
            Display Layers:
          </span>

          <button
            onClick={() => setShowIncidents((v) => !v)}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition-all ${
              showIncidents
                ? 'border-orange-500/50 bg-orange-500/15 text-orange-200'
                : 'border-edge bg-panel2/40 text-slate-500 hover:text-slate-300'
            }`}
          >
            {showIncidents ? '✓ ' : ''}Incidents ({visibleIncidents.length})
          </button>

          <button
            onClick={() => setShowResources((v) => !v)}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition-all ${
              showResources
                ? 'border-sky-500/50 bg-sky-500/15 text-sky-200'
                : 'border-edge bg-panel2/40 text-slate-500 hover:text-slate-300'
            }`}
          >
            {showResources ? '✓ ' : ''}Fleet Resources ({visibleResources.length})
          </button>

          <div className="h-4 w-px bg-edge mx-1 hidden sm:block" />

          {/* Quick Sub-filters */}
          <button
            onClick={() => setFilterCritical((v) => !v)}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold border transition-all ${
              filterCritical
                ? 'border-red-500/40 bg-red-500/15 text-red-300'
                : 'border-edge text-slate-600'
            }`}
          >
            Critical
          </button>

          <button
            onClick={() => setFilterHigh((v) => !v)}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold border transition-all ${
              filterHigh
                ? 'border-orange-500/40 bg-orange-500/15 text-orange-300'
                : 'border-edge text-slate-600'
            }`}
          >
            High
          </button>

          <button
            onClick={() => setFilterAvailable((v) => !v)}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold border transition-all ${
              filterAvailable
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                : 'border-edge text-slate-600'
            }`}
          >
            Available
          </button>

          <button
            onClick={() => setFilterAssigned((v) => !v)}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold border transition-all ${
              filterAssigned
                ? 'border-sky-500/40 bg-sky-500/15 text-sky-300'
                : 'border-edge text-slate-600'
            }`}
          >
            Assigned
          </button>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => setLegendOpen((v) => !v)}
            className={`rounded-md px-2 py-1 text-[11px] font-semibold border transition-all ${
              legendOpen
                ? 'border-sky-500/40 bg-sky-500/15 text-sky-300'
                : 'border-edge text-slate-500 hover:text-slate-300'
            }`}
          >
            🗺 Legend {legendOpen ? '▾' : '▸'}
          </button>
        </div>
      </div>

      {/* ── Main Workspace: Responsive Layout (Map + Detail Panel) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        
        {/* MAP CANVAS CONTAINER */}
        <div className="lg:col-span-8 xl:col-span-8 panel p-0 overflow-hidden relative select-none">
          
          {/* Map Controls Floating Toolbar */}
          <div className="absolute top-3 right-3 z-30 flex flex-col gap-1.5 bg-surface/90 backdrop-blur-md p-1.5 rounded-xl border border-edge shadow-xl">
            <button
              onClick={handleZoomIn}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-panel2 text-slate-300 hover:text-white hover:bg-edge text-base font-bold transition-all"
              title="Zoom In (+)"
            >
              +
            </button>
            <button
              onClick={handleZoomOut}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-panel2 text-slate-300 hover:text-white hover:bg-edge text-base font-bold transition-all"
              title="Zoom Out (-)"
            >
              −
            </button>
            <div className="h-px bg-edge my-0.5" />
            <button
              onClick={handleCenter}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-panel2 text-slate-300 hover:text-white hover:bg-edge text-xs font-bold transition-all"
              title="Center / Locate Selected (⌖)"
            >
              ⌖
            </button>
            <button
              onClick={handleResetView}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-panel2 text-slate-300 hover:text-white hover:bg-edge text-xs font-bold transition-all"
              title="Reset View (⟲)"
            >
              ⟲
            </button>
          </div>

          {/* Tactical Zoom Indicator */}
          <div className="absolute top-3 left-3 z-20 pointer-events-none flex items-center gap-2 bg-surface/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-edge text-[11px] mono text-slate-400">
            <span className="text-sky-400 font-bold">GRID ZOOM: {Math.round(zoom * 100)}%</span>
            <span>·</span>
            <span>SECTOR 4</span>
          </div>

          {/* Compass / Cardinal Rose */}
          <div className="absolute bottom-3 right-3 z-20 pointer-events-none flex flex-col items-center justify-center bg-surface/80 backdrop-blur-md h-12 w-12 rounded-full border border-edge text-[10px] mono text-slate-400">
            <span className="text-sky-400 font-bold -mb-1">N</span>
            <div className="flex items-center gap-1.5 text-[8px] text-slate-600">
              <span>W</span>
              <span className="text-slate-400 text-xs">⌖</span>
              <span>E</span>
            </div>
            <span className="text-[8px] text-slate-600 -mt-1">S</span>
          </div>

          {/* Scale Indicator */}
          <div className="absolute bottom-3 left-3 z-20 pointer-events-none flex items-center gap-2 bg-surface/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-edge text-[10px] mono text-slate-400">
            <div className="w-12 h-1 border-b-2 border-l-2 border-r-2 border-slate-400" />
            <span>2.5 KM</span>
          </div>

          {/* MAP CANVAS (SVG) */}
          <div
            className={`w-full overflow-hidden bg-[#060e1b] ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
            style={{ minHeight: '560px' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="w-full h-full"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.15s ease-out',
              }}
            >
              <defs>
                {/* Tactical grid pattern */}
                <pattern id="tacgrid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(28,46,71,0.6)" strokeWidth="0.5" />
                  <circle cx="0" cy="0" r="1" fill="rgba(56,189,248,0.3)" />
                </pattern>
                
                {/* Secondary fine grid */}
                <pattern id="finegrid" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(28,46,71,0.2)" strokeWidth="0.3" />
                </pattern>

                {/* Radar radar glow */}
                <radialGradient id="center-radar" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(56,189,248,0.08)" />
                  <stop offset="60%" stopColor="rgba(56,189,248,0.02)" />
                  <stop offset="100%" stopColor="transparent" />
                </radialGradient>
              </defs>

              {/* Background layers */}
              <rect width={W} height={H} fill="#050c18" />
              <rect width={W} height={H} fill="url(#finegrid)" />
              <rect width={W} height={H} fill="url(#tacgrid)" />
              <circle cx={W / 2} cy={H / 2} r={W * 0.45} fill="url(#center-radar)" />

              {/* Concentric radar range rings */}
              {[120, 220, 320, 420].map((r) => (
                <circle
                  key={r}
                  cx={W / 2}
                  cy={H / 2}
                  r={r}
                  fill="none"
                  stroke="rgba(28,52,82,0.5)"
                  strokeWidth="0.8"
                  strokeDasharray="4 6"
                />
              ))}

              {/* Major arterial expressway lines (simulated) */}
              <g stroke="rgba(37,60,92,0.85)" strokeWidth="6" strokeLinecap="round">
                <path d={`M ${PAD} ${H * 0.3} Q ${W * 0.4} ${H * 0.28} ${W - PAD} ${H * 0.35}`} fill="none" />
                <path d={`M ${W * 0.3} ${PAD} Q ${W * 0.35} ${H * 0.5} ${W * 0.28} ${H - PAD}`} fill="none" />
                <path d={`M ${PAD} ${H * 0.72} L ${W - PAD} ${H * 0.68}`} fill="none" />
                <path d={`M ${W * 0.7} ${PAD} L ${W * 0.72} ${H - PAD}`} fill="none" />
                {/* Diagonal Outer Ring Road link */}
                <path d={`M ${W * 0.15} ${H * 0.85} L ${W * 0.85} ${H * 0.15}`} fill="none" strokeWidth="3" strokeDasharray="8 4" stroke="rgba(56,189,248,0.25)" />
              </g>

              {/* Tactical Zone Labels */}
              <text x={PAD + 20} y={PAD + 20} fill="rgba(100,116,139,0.4)" fontSize="10" className="mono" fontWeight="bold">
                ZONE 1 · CBD NORTH
              </text>
              <text x={W - PAD - 120} y={PAD + 20} fill="rgba(100,116,139,0.4)" fontSize="10" className="mono" fontWeight="bold">
                ZONE 2 · WHITEFIELD
              </text>
              <text x={PAD + 20} y={H - PAD - 10} fill="rgba(100,116,139,0.4)" fontSize="10" className="mono" fontWeight="bold">
                ZONE 3 · SOUTH KORAMANGALA
              </text>
              <text x={W - PAD - 120} y={H - PAD - 10} fill="rgba(100,116,139,0.4)" fontSize="10" className="mono" fontWeight="bold">
                ZONE 4 · BELLANDUR SECTOR
              </text>

              {/* ── Assignment Vector Lines ── */}
              {visibleAssignments.map(({ inc, res }) => {
                const ip = posMap[inc.id]
                const rp = posMap[res.id]
                if (!ip || !rp) return null
                const isSelectedLine =
                  selectedEntity?.data?.id === inc.id || selectedEntity?.data?.id === res.id

                return (
                  <g key={`route-${inc.id}-${res.id}`}>
                    {/* Glow backdrop line */}
                    <line
                      x1={rp[0]}
                      y1={rp[1]}
                      x2={ip[0]}
                      y2={ip[1]}
                      stroke="#38bdf8"
                      strokeWidth={isSelectedLine ? '5' : '3'}
                      opacity={isSelectedLine ? 0.35 : 0.1}
                    />
                    {/* Animated dashed vector line */}
                    <line
                      x1={rp[0]}
                      y1={rp[1]}
                      x2={ip[0]}
                      y2={ip[1]}
                      stroke="#38bdf8"
                      strokeWidth={isSelectedLine ? '2' : '1.2'}
                      strokeDasharray="5 5"
                      opacity={isSelectedLine ? 0.95 : 0.6}
                    />
                  </g>
                )
              })}

              {/* ── FLEET RESOURCE MARKERS ── */}
              {visibleResources.map((res) => {
                const p = posMap[res.id]
                if (!p) return null
                const st = RESOURCE_STATUS[res.status] || RESOURCE_STATUS.available
                const isSelected = selectedEntity?.data?.id === res.id
                const isDown = res.status === 'unavailable' || res.status === 'maintenance'
                const isAssigned = res.status === 'assigned'
                const icon = RESOURCE_ICON[res.type] || '🚚'

                return (
                  <g
                    key={`res-${res.id}`}
                    className="cursor-pointer group"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSelectResource(res)
                    }}
                  >
                    {/* Selection ring */}
                    {isSelected && (
                      <circle
                        cx={p[0]}
                        cy={p[1]}
                        r="20"
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="2"
                        strokeDasharray="4 2"
                        className="animate-spin"
                        style={{ transformOrigin: `${p[0]}px ${p[1]}px` }}
                      />
                    )}

                    {/* Unit Box */}
                    <rect
                      x={p[0] - 13}
                      y={p[1] - 13}
                      width="26"
                      height="26"
                      rx="7"
                      fill="#071322"
                      stroke={st.color}
                      strokeWidth={isSelected ? '2.5' : '1.5'}
                      className="transition-all"
                    />

                    {/* Status dot in corner */}
                    <circle
                      cx={p[0] + 9}
                      cy={p[1] - 9}
                      r="3.5"
                      fill={st.color}
                      stroke="#071322"
                      strokeWidth="1"
                    />

                    {/* Emoji / Icon */}
                    <text
                      x={p[0]}
                      y={p[1] + 5}
                      textAnchor="middle"
                      fontSize="12"
                      className="pointer-events-none"
                    >
                      {icon}
                    </text>

                    {/* ID Label tag */}
                    <rect
                      x={p[0] - 14}
                      y={p[1] + 16}
                      width="28"
                      height="12"
                      rx="3"
                      fill="rgba(7,19,34,0.9)"
                      stroke={st.color}
                      strokeWidth="0.5"
                    />
                    <text
                      x={p[0]}
                      y={p[1] + 25}
                      textAnchor="middle"
                      fontSize="8"
                      fontWeight="bold"
                      className="mono"
                      fill={st.color}
                    >
                      {res.id}
                    </text>
                  </g>
                )
              })}

              {/* ── INCIDENT MARKERS ── */}
              {visibleIncidents.map((inc) => {
                const p = posMap[inc.id]
                if (!p) return null
                const sev = SEVERITY[inc.severity] || SEVERITY.medium
                const isSelected = selectedEntity?.data?.id === inc.id
                const isCrit = inc.severity === 'critical'
                const isHigh = inc.severity === 'high'
                const icon = INCIDENT_ICON[inc.type] || '⚠'

                return (
                  <g
                    key={`inc-${inc.id}`}
                    className="cursor-pointer group"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSelectIncident(inc)
                    }}
                  >
                    {/* Pulsating danger radius */}
                    {isCrit && (
                      <circle
                        cx={p[0]}
                        cy={p[1]}
                        r="28"
                        fill={sev.color}
                        opacity="0.16"
                        className="animate-pulse"
                      />
                    )}

                    {/* Selection highlight ring */}
                    {isSelected && (
                      <circle
                        cx={p[0]}
                        cy={p[1]}
                        r="22"
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="2"
                        strokeDasharray="4 2"
                      />
                    )}

                    {/* Outer Incident Ring */}
                    <circle
                      cx={p[0]}
                      cy={p[1]}
                      r={isCrit ? '14' : '12'}
                      fill={sev.color}
                      stroke="#060e1b"
                      strokeWidth="2.5"
                      style={{
                        boxShadow: `0 0 12px ${sev.color}`,
                        filter: `drop-shadow(0 0 6px ${sev.color})`,
                      }}
                    />

                    {/* Incident Icon */}
                    <text
                      x={p[0]}
                      y={p[1] + 4}
                      textAnchor="middle"
                      fontSize={isCrit ? '11' : '10'}
                      className="pointer-events-none"
                    >
                      {icon}
                    </text>

                    {/* Incident ID Label Tag */}
                    <rect
                      x={p[0] + 16}
                      y={p[1] - 10}
                      width="52"
                      height="18"
                      rx="4"
                      fill="rgba(6,14,27,0.95)"
                      stroke={sev.color}
                      strokeWidth="1"
                    />
                    <text
                      x={p[0] + 42}
                      y={p[1] + 2}
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="bold"
                      className="mono"
                      fill="#f8fafc"
                    >
                      {inc.id}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>

          {/* ── Map Legend Drawer ── */}
          {legendOpen && (
            <div className="absolute bottom-12 left-3 z-30 w-72 rounded-xl border border-edge bg-panel/95 backdrop-blur-xl p-3 shadow-2xl slide-up text-xs space-y-2">
              <div className="flex items-center justify-between border-b border-edge/60 pb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Tactical Map Legend
                </span>
                <button
                  onClick={() => setLegendOpen(false)}
                  className="text-slate-500 hover:text-slate-300 text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-500 animate-pulse border border-white" />
                  <span className="text-slate-200 font-semibold">Critical Incident</span>
                  <span className="text-slate-500 text-[10px] ml-auto">P1 Urgent</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-orange-500" />
                  <span className="text-slate-200">High-Priority Incident</span>
                  <span className="text-slate-500 text-[10px] ml-auto">P2</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-md border border-emerald-400 bg-emerald-500/20 text-[9px] flex items-center justify-center font-bold text-emerald-400">
                    A
                  </span>
                  <span className="text-slate-200">Available Resource</span>
                  <span className="text-emerald-400 text-[10px] ml-auto">Standby</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-md border border-sky-400 bg-sky-500/20 text-[9px] flex items-center justify-center font-bold text-sky-400">
                    F
                  </span>
                  <span className="text-slate-200">Assigned Resource</span>
                  <span className="text-sky-400 text-[10px] ml-auto">En Route</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-md border border-purple-400 bg-purple-500/20 text-[9px] flex items-center justify-center font-bold text-purple-400">
                    M
                  </span>
                  <span className="text-slate-200">Unavailable / Maintenance</span>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-edge/50">
                  <div className="w-6 border-b-2 border-dashed border-sky-400" />
                  <span className="text-slate-400 text-[10px]">
                    Active Dispatch Route Vector
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── SIDE INFORMATION PANEL ── */}
        <div className="lg:col-span-4 xl:col-span-4 space-y-3">
          {selectedEntity?.type === 'incident' ? (
            /* INCIDENT DETAIL PANEL */
            <div className="panel p-4 space-y-4 slide-in">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-edge pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-edge/80 text-xl border border-edge-2">
                    {INCIDENT_ICON[selectedEntity.data.type] || '⚠'}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="mono text-base font-bold text-white">
                        {selectedEntity.data.id}
                      </span>
                      <span
                        className="badge text-[10px]"
                        style={{
                          color: SEVERITY[selectedEntity.data.severity]?.color,
                          borderColor: `${SEVERITY[selectedEntity.data.severity]?.color}40`,
                          background: `${SEVERITY[selectedEntity.data.severity]?.color}15`,
                        }}
                      >
                        {SEVERITY[selectedEntity.data.severity]?.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 capitalize">
                      {pretty(selectedEntity.data.type)}
                    </p>
                  </div>
                </div>

                <span className="mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                  Urgency {selectedEntity.data.urgency}/10
                </span>
              </div>

              {/* Description */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Situation Assessment
                </span>
                <p className="text-xs text-slate-200 leading-relaxed bg-panel2/40 p-2.5 rounded-lg border border-edge/60">
                  {selectedEntity.data.description}
                </p>
              </div>

              {/* Location & Reported */}
              <div className="space-y-1.5 text-xs text-slate-300 bg-panel2/50 rounded-lg p-3 border border-edge">
                <div className="flex items-center gap-2">
                  <span>📍</span>
                  <span className="font-semibold text-slate-200">
                    {selectedEntity.data.location_name}
                  </span>
                </div>
                <div className="flex items-center justify-between mono text-[11px] text-slate-400 pt-1">
                  <span>
                    Lat: {selectedEntity.data.latitude?.toFixed(4)}, Lng:{' '}
                    {selectedEntity.data.longitude?.toFixed(4)}
                  </span>
                  <span>{timeSince(selectedEntity.data.created_at)}</span>
                </div>
              </div>

              {/* Assigned Resources Units */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Dispatched Fleet Units (
                    {selectedEntity.data.assigned_resources?.length || 0})
                  </span>
                  <span className="mono text-[10px] text-sky-400">Active Links</span>
                </div>

                {selectedEntity.data.assigned_resources &&
                selectedEntity.data.assigned_resources.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {selectedEntity.data.assigned_resources.map((rid) => {
                      const resObj = MOCK_RESOURCES.find((r) => r.id === rid)
                      return (
                        <button
                          key={rid}
                          onClick={() => resObj && handleSelectResource(resObj)}
                          className="flex items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 p-2 text-left hover:bg-sky-500/20 transition-all group"
                        >
                          <span className="text-base">
                            {resObj ? RESOURCE_ICON[resObj.type] : '🚚'}
                          </span>
                          <div className="min-w-0">
                            <span className="mono text-xs font-bold text-white group-hover:text-sky-300">
                              {rid}
                            </span>
                            <p className="text-[10px] text-slate-400 truncate">
                              {resObj ? resObj.callsign : 'Deployed Unit'}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-edge p-3 text-center text-xs text-slate-500">
                    No resources currently assigned to this incident.
                  </div>
                )}
              </div>

              {/* Required Resources badges */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Required Capabilities:
                </span>
                <div className="flex flex-wrap gap-1">
                  {selectedEntity.data.required_resources?.map((r) => {
                    const isMissing = selectedEntity.data.missing_resources?.includes(r)
                    return (
                      <span
                        key={r}
                        className="badge text-[10px]"
                        style={
                          isMissing
                            ? {
                                color: '#fca5a5',
                                borderColor: 'rgba(239,68,68,0.4)',
                                background: 'rgba(239,68,68,0.1)',
                              }
                            : {
                                color: '#86efac',
                                borderColor: 'rgba(34,197,94,0.35)',
                                background: 'rgba(34,197,94,0.08)',
                              }
                        }
                      >
                        {isMissing ? '✕ Missing: ' : '✓ Assigned: '}
                        {prettyCap(r)}
                      </span>
                    )
                  })}
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-2 border-t border-edge flex items-center justify-between">
                <button
                  onClick={handleCenter}
                  className="btn btn-sim text-xs flex items-center gap-1.5"
                >
                  <span>⌖</span>
                  <span>Center Marker</span>
                </button>
                <span className="text-[10px] mono text-slate-500">
                  Status: {selectedEntity.data.status}
                </span>
              </div>
            </div>
          ) : selectedEntity?.type === 'resource' ? (
            /* RESOURCE DETAIL PANEL */
            <div className="panel p-4 space-y-4 slide-in">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-edge pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-edge/80 text-xl border border-edge-2">
                    {RESOURCE_ICON[selectedEntity.data.type] || '🚚'}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="mono text-base font-bold text-white">
                        {selectedEntity.data.id}
                      </span>
                      <span
                        className="badge text-[10px]"
                        style={{
                          color: RESOURCE_STATUS[selectedEntity.data.status]?.color,
                          borderColor: `${RESOURCE_STATUS[selectedEntity.data.status]?.color}40`,
                          background: `${RESOURCE_STATUS[selectedEntity.data.status]?.color}15`,
                        }}
                      >
                        {RESOURCE_STATUS[selectedEntity.data.status]?.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 capitalize">
                      {RESOURCE_TYPE_LABELS[selectedEntity.data.type] ||
                        selectedEntity.data.type}
                    </p>
                  </div>
                </div>

                <span className="mono text-xs font-semibold text-slate-400">
                  {selectedEntity.data.callsign}
                </span>
              </div>

              {/* Assignment Notice */}
              {selectedEntity.data.current_assignment ? (
                <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                      Dispatched to Incident
                    </span>
                    <span className="mono text-xs font-bold text-white">
                      {selectedEntity.data.current_assignment}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    En route to emergency sector. Estimated travel time:{' '}
                    <strong className="text-white mono">
                      {selectedEntity.data.eta ?? '—'} mins
                    </strong>
                  </p>
                  {/* Shortcut to view incident */}
                  {(() => {
                    const linkedInc = MOCK_INCIDENTS.find(
                      (i) => i.id === selectedEntity.data.current_assignment
                    )
                    return linkedInc ? (
                      <button
                        onClick={() => handleSelectIncident(linkedInc)}
                        className="btn text-[11px] py-1 px-2.5 mt-1.5 w-full hover:text-white"
                      >
                        Inspect Incident {linkedInc.id} →
                      </button>
                    ) : null
                  })()}
                </div>
              ) : (
                <div className="rounded-lg border border-edge bg-panel2/50 p-3 text-xs text-slate-400 flex items-center gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>Unit is currently on Standby and available for dispatch.</span>
                </div>
              )}

              {/* Location & Base */}
              <div className="space-y-1.5 text-xs text-slate-300 bg-panel2/50 rounded-lg p-3 border border-edge">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">
                    Current Position
                  </span>
                  <p className="font-semibold text-slate-200">
                    📍 {selectedEntity.data.location_name}
                  </p>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-edge/50">
                  <span>Base: {selectedEntity.data.base_station || 'Central Depot'}</span>
                  <span className="mono">
                    {selectedEntity.data.latitude?.toFixed(4)},{' '}
                    {selectedEntity.data.longitude?.toFixed(4)}
                  </span>
                </div>
              </div>

              {/* Crew & Capabilities */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Unit Profile & Crew
                </span>
                <div className="rounded-lg bg-panel2/40 border border-edge p-2.5 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Crew Size:</span>
                    <span className="mono font-bold text-white">
                      {selectedEntity.data.crew_size} personnel
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Lead Commander:</span>
                    <span className="text-slate-200 font-medium">
                      {selectedEntity.data.commander || 'Unit Supervisor'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Capabilities pills */}
              {selectedEntity.data.capabilities && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                    Equipment Kit
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {selectedEntity.data.capabilities.map((cap, i) => (
                      <span
                        key={i}
                        className="badge text-[10px] border-edge bg-panel2 text-slate-300"
                      >
                        ⚡ {cap}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="pt-2 border-t border-edge flex items-center justify-between">
                <button
                  onClick={handleCenter}
                  className="btn btn-sim text-xs flex items-center gap-1.5"
                >
                  <span>⌖</span>
                  <span>Center Unit</span>
                </button>
                <span className="text-[10px] mono text-slate-500">
                  Readiness: {selectedEntity.data.availability}
                </span>
              </div>
            </div>
          ) : (
            /* DEFAULT / EMPTY SELECTION OVERVIEW */
            <div className="panel p-6 text-center space-y-3">
              <div className="text-3xl">🗺</div>
              <h4 className="text-sm font-bold text-slate-200">Tactical Inspection</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Click any incident icon or fleet marker on the map to inspect live telemetry,
                coordinates, and assigned resources.
              </p>
              <div className="pt-2 border-t border-edge text-left space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Active Hotspots:
                </span>
                {MOCK_INCIDENTS.slice(0, 3).map((inc) => (
                  <button
                    key={inc.id}
                    onClick={() => handleSelectIncident(inc)}
                    className="w-full flex items-center justify-between p-2 rounded-lg bg-panel2/60 border border-edge hover:border-sky-500/40 text-xs text-left"
                  >
                    <span className="mono font-bold text-white">{inc.id}</span>
                    <span className="text-slate-400 truncate max-w-[160px]">
                      {inc.location_name}
                    </span>
                    <span className="text-sky-400">→</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  )
}
