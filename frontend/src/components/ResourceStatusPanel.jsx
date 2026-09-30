import { MOCK_RESOURCES } from '../data/mockData.js'
import { RESOURCE_STATUS, RESOURCE_ICON, RESOURCE_GLYPH, pretty } from '../types/constants.js'

const FLEET_TYPES = [
  { type: 'ambulance',    label: 'Ambulances',    icon: '🚑', color: '#22c55e' },
  { type: 'fire_team',    label: 'Fire Units',    icon: '🚒', color: '#f97316' },
  { type: 'police_unit',  label: 'Police Units',  icon: '🚓', color: '#3b82f6' },
  { type: 'rescue_team',  label: 'Rescue Teams',  icon: '🪖', color: '#a78bfa' },
  { type: 'medical_unit', label: 'Medical Units', icon: '🏥', color: '#38bdf8' },
]

export default function ResourceStatusPanel({ resources: propResources }) {
  const resourceList = propResources || MOCK_RESOURCES
  const byType = (type) => resourceList.filter(r => r.type === type)

  return (
    <div className="panel">
      <div className="panel-title">
        <span className="text-blue-400">🚑</span>
        <span>Resource Status</span>
        <span className="mono rounded-full bg-edge px-2 py-0.5 text-[10px] text-slate-400">
          {resourceList.length} total
        </span>
      </div>

      <div className="divide-y divide-edge/50">
        {FLEET_TYPES.map(ft => {
          const units     = byType(ft.type)
          const available = units.filter(u => u.status === 'available').length
          const assigned  = units.filter(u => u.status === 'assigned').length
          const offline   = units.filter(u => u.status === 'unavailable' || u.status === 'maintenance').length
          const pctAvail  = units.length > 0 ? (available / units.length) * 100 : 0
          const pctAssign = units.length > 0 ? (assigned  / units.length) * 100 : 0

          return (
            <div key={ft.type} className="px-4 py-3">
              {/* Section header */}
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-base">{ft.icon}</span>
                  <span className="text-sm font-semibold text-slate-300">{ft.label}</span>
                  <span className="mono text-[10px] text-slate-600">{units.length} units</span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-green-400 font-semibold">{available} free</span>
                  <span className="text-slate-600">/</span>
                  <span className="text-blue-400">{assigned} on call</span>
                  {offline > 0 && <><span className="text-slate-600">/</span><span className="text-red-400">{offline} down</span></>}
                </div>
              </div>

              {/* Stacked bar */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-edge mb-3">
                <div className="flex h-full">
                  <div className="h-full bg-green-500 transition-all" style={{ width: `${pctAvail}%` }} />
                  <div className="h-full bg-blue-500 transition-all"  style={{ width: `${pctAssign}%` }} />
                  {offline > 0 && <div className="h-full bg-red-500 transition-all" style={{ width: `${(offline / units.length) * 100}%` }} />}
                </div>
              </div>

              {/* Unit grid */}
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-4">
                {units.map(r => {
                  const st = RESOURCE_STATUS[r.status] || RESOURCE_STATUS.available
                  const isDown = r.status === 'unavailable' || r.status === 'maintenance'

                  return (
                    <div
                      key={r.id}
                      className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs"
                      style={{
                        borderColor: `${st.color}30`,
                        background:  `${st.color}08`,
                        opacity: isDown ? 0.65 : 1,
                      }}
                    >
                      {/* Glyph */}
                      <div
                        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-[11px] font-black"
                        style={{ background: `${st.color}20`, color: st.color }}
                      >
                        {RESOURCE_GLYPH[r.type]}
                      </div>
                      <div className="min-w-0">
                        <p className="mono font-bold text-slate-200 text-[11px]">{r.id}</p>
                        <p className="text-[10px]" style={{ color: st.color }}>{st.label}</p>
                        {r.current_assignment && (
                          <p className="mono text-[10px] text-sky-400">{r.current_assignment}</p>
                        )}
                      </div>
                      {isDown && <span className="ml-auto text-red-400 text-[10px]">✗</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
