import { RESOURCE_STATUS, RESOURCE_GLYPH, pretty } from '../types/constants.js'

const TYPE_ICON = {
  ambulance:    '🚑',
  fire_team:    '🚒',
  rescue_team:  '🪖',
  medical_unit: '🏥',
  shelter:      '⛺',
}

export default function ResourceTable({ resources = [] }) {
  const grouped = resources.reduce((acc, r) => {
    acc[r.type] = acc[r.type] || []
    acc[r.type].push(r)
    return acc
  }, {})

  return (
    <div className="panel">
      <div className="panel-title">
        <span className="text-blue-600">🚑</span>
        <span>Resource Fleet</span>
        <span className="mono rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 font-bold">
          {resources.length}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th>Unit</th>
              <th>Type</th>
              <th>Status</th>
              <th>Location</th>
              <th>Assignment</th>
              <th>ETA</th>
            </tr>
          </thead>
          <tbody>
            {resources.map(r => {
              const st = RESOURCE_STATUS[r.status] || RESOURCE_STATUS.available
              const isDown = r.status === 'unavailable' || r.status === 'maintenance'
              const isAssigned = r.status === 'assigned'

              return (
                <tr key={r.id} className={isDown ? 'opacity-60' : ''}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-lg border text-sm font-bold"
                        style={{
                          borderColor: `${st.color}50`,
                          background: `${st.color}12`,
                          color: st.color,
                        }}
                      >
                        {RESOURCE_GLYPH[r.type] || '?'}
                      </div>
                      <span className="mono font-bold text-slate-800">{r.id}</span>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <span>{TYPE_ICON[r.type] || '🚗'}</span>
                      <span className="text-slate-700 font-medium">{pretty(r.type)}</span>
                    </div>
                  </td>
                  <td>
                    <div>
                      <span
                        className="badge"
                        style={{
                          color: st.color,
                          borderColor: `${st.color}40`,
                          background: `${st.color}12`,
                        }}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${isDown ? 'animate-flash' : ''}`}
                          style={{ background: st.color }}
                        />
                        {st.label}
                      </span>
                      {r.status_reason && (
                        <p className="mt-0.5 text-[10px] text-slate-500">{r.status_reason}</p>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="mono text-xs text-slate-500">
                      {r.latitude?.toFixed(3)}, {r.longitude?.toFixed(3)}
                    </span>
                  </td>
                  <td>
                    {r.current_assignment
                      ? <span className="mono text-xs text-blue-700 font-semibold">{r.current_assignment}</span>
                      : <span className="text-slate-400">—</span>
                    }
                  </td>
                  <td>
                    {r.eta != null
                      ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-emerald-600">⟳</span>
                          <span className="mono text-xs text-slate-700 font-semibold">{r.eta} min</span>
                        </div>
                      )
                      : <span className="text-slate-400">—</span>
                    }
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Fleet overview mini-grid */}
      <div className="border-t border-slate-200 px-4 py-3 bg-slate-50/50">
        <p className="mb-2 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Fleet by type</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(grouped).map(([type, units]) => {
            const avail = units.filter(u => u.status === 'available').length
            const total = units.length
            return (
              <div key={type} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-2xs">
                <span>{TYPE_ICON[type] || '🚗'}</span>
                <span className="text-slate-700 font-medium">{pretty(type)}</span>
                <span className="mono font-bold" style={{ color: avail > 0 ? '#16a34a' : '#dc2626' }}>
                  {avail}/{total}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
