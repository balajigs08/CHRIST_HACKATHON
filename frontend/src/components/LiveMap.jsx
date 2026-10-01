import { useState } from 'react'
import { RESOURCE_GLYPH, RESOURCE_STATUS, SEVERITY, pretty } from '../types/constants.js'

const W = 880, H = 520, PAD = 56

const TYPE_ICON = {
  ambulance: '🚑', fire_team: '🚒', rescue_team: '🪖', medical_unit: '🏥', shelter: '⛺',
}

export default function LiveMap({ incidents = [], resources = [], assignments = [] }) {
  const [selected, setSelected] = useState(null)
  const [showLabels, setShowLabels] = useState(true)

  const live = incidents.filter(i => i.status !== 'resolved')
  const pts  = [...live, ...resources]
  const lats = pts.map(p => p.latitude  ?? 12.97)
  const lons = pts.map(p => p.longitude ?? 77.63)

  const minLat = Math.min(...lats, 12.9)  - 0.015
  const maxLat = Math.max(...lats, 13.05) + 0.015
  const minLon = Math.min(...lons, 77.55) - 0.015
  const maxLon = Math.max(...lons, 77.75) + 0.015

  const px  = lon  => PAD + ((lon - minLon) / (maxLon - minLon)) * (W - 2 * PAD)
  const py  = lat  => H - PAD - ((lat - minLat) / (maxLat - minLat)) * (H - 2 * PAD)
  const pos = Object.fromEntries([...live, ...resources].map(p => [p.id, [px(p.longitude), py(p.latitude)]]))

  const assignedResIds = new Set(assignments.map(a => a.resource_id))
  const selObj = selected
    ? (live.find(i => i.id === selected) || resources.find(r => r.id === selected))
    : null

  return (
    <div className="panel overflow-hidden">
      {/* Header */}
      <div className="panel-title">
        <span className="text-sky-600">📍</span>
        <span>Live Tactical Map</span>
        <span className="text-slate-500 font-normal normal-case ml-1">· simulated coordinates</span>
        <div className="ml-auto flex items-center gap-2 normal-case">
          <button
            onClick={() => setShowLabels(l => !l)}
            className={`rounded-md border px-2.5 py-0.5 text-[10px] font-semibold transition-all ${
              showLabels ? 'border-sky-300 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            Labels
          </button>
          <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-emerald-700 font-bold">LIVE</span>
          </div>
        </div>
      </div>

      {/* SVG Map */}
      <div className="map-container">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full cursor-crosshair select-none"
          onClick={() => setSelected(null)}
        >
          {/* Background city blocks */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(203,213,225,0.6)" strokeWidth="0.5" />
            </pattern>
            <radialGradient id="mapGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="rgba(2,132,199,0.05)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
            <filter id="blur-sm">
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>

          <rect width={W} height={H} fill="url(#grid)" />
          <ellipse cx={W/2} cy={H/2} rx={W*0.4} ry={H*0.4} fill="url(#mapGlow)" />

          {/* City road lines */}
          {[0.2, 0.4, 0.6, 0.8].map(f => (
            <g key={f}>
              <line x1={PAD} y1={PAD + (H - 2*PAD)*f} x2={W-PAD} y2={PAD + (H - 2*PAD)*f}
                stroke="rgba(203,213,225,0.8)" strokeWidth="6" />
              <line x1={PAD + (W - 2*PAD)*f} y1={PAD} x2={PAD + (W - 2*PAD)*f} y2={H-PAD}
                stroke="rgba(203,213,225,0.8)" strokeWidth="6" />
            </g>
          ))}

          {/* Assignment lines with animated dash */}
          {assignments.map(a => {
            const r = pos[a.resource_id], i = pos[a.incident_id]
            if (!r || !i) return null
            return (
              <g key={a.id}>
                {/* Glow line */}
                <line x1={r[0]} y1={r[1]} x2={i[0]} y2={i[1]}
                  stroke="#0284c7" strokeWidth="4" opacity="0.12" filter="url(#blur-sm)" />
                {/* Actual line */}
                <line x1={r[0]} y1={r[1]} x2={i[0]} y2={i[1]}
                  stroke="#0284c7" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.8"
                  style={{ animation: 'none' }}
                />
                {/* Arrow at midpoint */}
                <circle
                  cx={(r[0] + i[0]) / 2}
                  cy={(r[1] + i[1]) / 2}
                  r="2.5"
                  fill="#0284c7" opacity="0.9"
                />
              </g>
            )
          })}

          {/* Resources */}
          {resources.map(r => {
            if (!pos[r.id]) return null
            const [cx, cy] = pos[r.id]
            const st = RESOURCE_STATUS[r.status] || RESOURCE_STATUS.available
            const isDown = r.status === 'unavailable' || r.status === 'maintenance'
            const isSel  = selected === r.id

            return (
              <g key={r.id} opacity={isDown ? 0.6 : 1}
                onClick={e => { e.stopPropagation(); setSelected(r.id === selected ? null : r.id) }}
                style={{ cursor: 'pointer' }}>
                {/* Selection ring */}
                {isSel && <circle cx={cx} cy={cy} r="22" fill="none" stroke={st.color} strokeWidth="2" strokeDasharray="4 3" opacity="0.9" />}

                {/* Unit box */}
                <rect x={cx-14} y={cy-14} width="28" height="28" rx="7"
                  fill="#ffffff" stroke={st.color} strokeWidth={isSel ? 3 : 2} />

                {/* Glyph */}
                <text x={cx} y={cy+5} textAnchor="middle" fontSize="13" fontWeight="800" fill={st.color}>
                  {RESOURCE_GLYPH[r.type] || '?'}
                </text>

                {/* Offline X */}
                {isDown && (
                  <>
                    <line x1={cx-10} y1={cy-10} x2={cx+10} y2={cy+10} stroke="#dc2626" strokeWidth="2.5" />
                    <line x1={cx+10} y1={cy-10} x2={cx-10} y2={cy+10} stroke="#dc2626" strokeWidth="2.5" />
                  </>
                )}

                {/* Status dot */}
                <circle cx={cx+11} cy={cy-11} r="4"
                  fill={isDown ? '#dc2626' : assignedResIds.has(r.id) ? '#2563eb' : '#16a34a'}
                  stroke="#ffffff" strokeWidth="1.5" />

                {/* Label */}
                {showLabels && (
                  <text x={cx} y={cy+30} textAnchor="middle" fontSize="10" fill="#475569" fontWeight="600">
                    {r.id}
                  </text>
                )}
              </g>
            )
          })}

          {/* Incidents */}
          {live.map(i => {
            if (!pos[i.id]) return null
            const [cx, cy] = pos[i.id]
            const sev = SEVERITY[i.severity] || SEVERITY.low
            const isSel = selected === i.id

            return (
              <g key={i.id}
                onClick={e => { e.stopPropagation(); setSelected(i.id === selected ? null : i.id) }}
                style={{ cursor: 'pointer' }}>
                {/* Critical pulse ring */}
                {i.severity === 'critical' && (
                  <circle cx={cx} cy={cy} r="22" fill={sev.color} opacity="0.18"
                    style={{ animation: 'flash 1.5s ease-in-out infinite' }} />
                )}
                {isSel && (
                  <circle cx={cx} cy={cy} r="17" fill="none" stroke={sev.color} strokeWidth="1.5" strokeDasharray="4 3" />
                )}
                {/* Main dot */}
                <circle cx={cx} cy={cy} r="11" fill={sev.color}
                  stroke={i.status === 'waiting' ? '#000' : '#ffffff'} strokeWidth="2"
                  strokeDasharray={i.status === 'waiting' ? '3 2' : '0'} />
                {/* Inner symbol */}
                <text x={cx} y={cy+4} textAnchor="middle" fontSize="9" fontWeight="800" fill="#ffffff">
                  {i.severity === 'critical' ? '!' : i.severity === 'high' ? '↑' : '·'}
                </text>
                {/* Label */}
                {showLabels && (
                  <text x={cx + 15} y={cy - 10} fontSize="10" fontWeight="700" fill="#0f172a">
                    {i.id}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Info panel for selected item */}
      {selObj && (
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs slide-up">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-bold text-slate-900 text-sm">{selObj.id}</p>
              <p className="text-slate-600 mt-0.5 font-medium">
                {selObj.type ? `${TYPE_ICON[selObj.type] || ''} ${pretty(selObj.type)}` : pretty(selObj.type)}
                {selObj.severity && ` · ${pretty(selObj.severity)} severity`}
                {selObj.status && ` · ${selObj.status}`}
              </p>
              {selObj.description && <p className="text-slate-500 mt-1 italic">{selObj.description}</p>}
            </div>
            <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-700 text-lg leading-none p-1">✕</button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-200 px-4 py-3 text-[11px] text-slate-600 bg-slate-50/50 font-medium">
        <span className="font-bold text-slate-500 uppercase tracking-wider">Incidents:</span>
        {Object.entries(SEVERITY).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: v.color }} />
            {v.label}
          </span>
        ))}
        <span className="mx-1 text-slate-300">|</span>
        <span className="font-bold text-slate-500 uppercase tracking-wider">Resources:</span>
        {['available','assigned','unavailable'].map(k => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm border-2" style={{ borderColor: RESOURCE_STATUS[k].color }} />
            {RESOURCE_STATUS[k].label}
          </span>
        ))}
        <span className="ml-2">┄ = assignment link</span>
      </div>
    </div>
  )
}
