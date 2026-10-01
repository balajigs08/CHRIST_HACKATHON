import { MOCK_INCIDENTS, MOCK_RESOURCES } from '../data/mockData.js'
import { SEVERITY, RESOURCE_STATUS, RESOURCE_GLYPH } from '../types/constants.js'

const W = 700, H = 380, PAD = 44

export default function LiveMapPlaceholder({ incidents = MOCK_INCIDENTS, resources = MOCK_RESOURCES }) {
  const incList = incidents && incidents.length > 0 ? incidents : MOCK_INCIDENTS
  const resList = resources && resources.length > 0 ? resources : MOCK_RESOURCES
  const live = incList.filter(i => i.status !== 'resolved')
  const pts  = [...live, ...resList]

  const lats = pts.map(p => p.latitude)
  const lons = pts.map(p => p.longitude)
  const minLat = Math.min(...lats) - 0.02
  const maxLat = Math.max(...lats) + 0.02
  const minLon = Math.min(...lons) - 0.02
  const maxLon = Math.max(...lons) + 0.02

  const px = lon  => PAD + ((lon  - minLon)  / (maxLon  - minLon))  * (W - 2 * PAD)
  const py = lat  => H   - PAD - ((lat  - minLat) / (maxLat - minLat)) * (H - 2 * PAD)

  const posMap = Object.fromEntries(
    pts.map(p => [p.id, [px(p.longitude), py(p.latitude)]])
  )

  // Build assignment lines
  const assignments = incList.flatMap(inc =>
    (inc.assigned_resources || []).map(rid => ({ incId: inc.id, resId: rid }))
  )

  return (
    <div className="panel overflow-hidden">
      <div className="panel-title">
        <span className="text-sky-400">📍</span>
        <span>Live Tactical Map</span>
        <span className="text-slate-700 font-normal normal-case ml-1">· Bengaluru metro, simulated coords</span>
        <div className="ml-auto flex items-center gap-2 normal-case">
          <span className="rounded-full border border-sky-500/25 bg-sky-500/08 px-2 py-0.5 text-[10px] text-sky-400">
            MOCK DATA
          </span>
          <span className="flex items-center gap-1 text-[10px] text-slate-600">
            No real map API · coordinates are simulated
          </span>
        </div>
      </div>

      {/* SVG canvas */}
      <div
        className="relative"
        style={{
          background: 'linear-gradient(180deg,#f8fafc 0%,#f1f5f9 100%)',
        }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none">
          <defs>
            <pattern id="mapgrid" width="35" height="35" patternUnits="userSpaceOnUse">
              <path d="M 35 0 L 0 0 0 35" fill="none" stroke="rgba(203,213,225,0.6)" strokeWidth="0.5" />
            </pattern>
            <radialGradient id="center-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="rgba(2,132,199,0.05)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>

          {/* Grid background */}
          <rect width={W} height={H} fill="url(#mapgrid)" />
          <ellipse cx={W/2} cy={H/2} rx={W*0.45} ry={H*0.45} fill="url(#center-glow)" />

          {/* Road lines (simulated) */}
          {[0.25, 0.5, 0.75].map(f => (
            <g key={f}>
              <line x1={PAD} y1={PAD + (H - 2*PAD)*f} x2={W-PAD} y2={PAD + (H - 2*PAD)*f}
                stroke="rgba(203,213,225,0.8)" strokeWidth="6" />
              <line x1={PAD + (W - 2*PAD)*f} y1={PAD} x2={PAD + (W - 2*PAD)*f} y2={H-PAD}
                stroke="rgba(203,213,225,0.8)" strokeWidth="6" />
            </g>
          ))}

          {/* Assignment lines */}
          {assignments.map(({ incId, resId }) => {
            const ip = posMap[incId], rp = posMap[resId]
            if (!ip || !rp) return null
            return (
              <g key={`${incId}-${resId}`}>
                <line x1={rp[0]} y1={rp[1]} x2={ip[0]} y2={ip[1]}
                  stroke="#0284c7" strokeWidth="4" opacity="0.15" />
                <line x1={rp[0]} y1={rp[1]} x2={ip[0]} y2={ip[1]}
                  stroke="#0284c7" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.8" />
              </g>
            )
          })}

          {/* Resources */}
          {resList.map(r => {
            const p  = posMap[r.id]
            if (!p) return null
            const st = RESOURCE_STATUS[r.status] || RESOURCE_STATUS.available
            const isDown = r.status === 'unavailable' || r.status === 'maintenance'

            return (
              <g key={r.id} opacity={isDown ? 0.55 : 1}>
                <rect x={p[0]-12} y={p[1]-12} width="24" height="24" rx="6"
                  fill="#ffffff" stroke={st.color} strokeWidth="2" />
                <text x={p[0]} y={p[1]+5} textAnchor="middle" fontSize="11"
                  fontWeight="800" fill={st.color}>
                  {RESOURCE_GLYPH[r.type] || '?'}
                </text>
                {isDown && (
                  <>
                    <line x1={p[0]-9} y1={p[1]-9} x2={p[0]+9} y2={p[1]+9} stroke="#dc2626" strokeWidth="2" />
                    <line x1={p[0]+9} y1={p[1]-9} x2={p[0]-9} y2={p[1]+9} stroke="#dc2626" strokeWidth="2" />
                  </>
                )}
                <circle cx={p[0]+9} cy={p[1]-9} r="3.5"
                  fill={isDown ? '#dc2626' : r.current_assignment ? '#2563eb' : '#16a34a'}
                  stroke="#ffffff" strokeWidth="1" />
                <text x={p[0]} y={p[1]+24} textAnchor="middle" fontSize="8" fontWeight="600" fill="#475569">{r.id}</text>
              </g>
            )
          })}

          {/* Incidents */}
          {live.map(i => {
            const p   = posMap[i.id]
            if (!p) return null
            const sev  = SEVERITY[i.severity] || SEVERITY.low
            const isCrit = i.severity === 'critical'

            return (
              <g key={i.id}>
                {isCrit && (
                  <circle cx={p[0]} cy={p[1]} r="18" fill={sev.color} opacity="0.18"
                    style={{ animation: 'flash 1.5s ease-in-out infinite' }} />
                )}
                <circle cx={p[0]} cy={p[1]} r="9" fill={sev.color}
                  stroke={i.status === 'waiting' ? '#000' : '#ffffff'} strokeWidth="2"
                  strokeDasharray={i.status === 'waiting' ? '3 2' : '0'} />
                <text x={p[0]+12} y={p[1]-8} fontSize="9" fontWeight="700" fill="#1e293b">
                  {i.id}
                </text>
              </g>
            )
          })}
        </svg>

        {/* Placeholder overlay label */}
        <div
          className="pointer-events-none absolute right-3 bottom-3 rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] mono text-slate-600 bg-white/90 shadow-2xs"
        >
          📍 Simulated coordinates grid
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 border-t border-slate-200 px-4 py-2.5 text-[11px] text-slate-600 bg-slate-50/50 font-medium">
        {Object.entries(SEVERITY).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: v.color }} />
            {v.label}
          </span>
        ))}
        <span className="text-slate-300">|</span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm border border-emerald-500 bg-emerald-50" />
          Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm border border-blue-500 bg-blue-50" />
          Assigned
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm border border-red-500 bg-red-50" />
          Offline
        </span>
        <span>┄ assignment link</span>
      </div>
    </div>
  )
}
