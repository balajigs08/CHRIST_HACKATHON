import { MOCK_PLAN } from '../data/mockData.js'
import { pretty, fmtTime } from '../types/constants.js'

const ASN_STATUS = {
  en_route:  { color: '#38bdf8', label: 'En Route',  icon: '→' },
  on_scene:  { color: '#22c55e', label: 'On Scene',  icon: '✓' },
  deploying: { color: '#fbbf24', label: 'Deploying', icon: '⟳' },
  assigned:  { color: '#3b82f6', label: 'Assigned',  icon: '·' },
}

const TYPE_ICON = {
  ambulance:    '🚑',
  fire_team:    '🚒',
  rescue_team:  '🪖',
  medical_unit: '🏥',
  shelter:      '⛺',
}

export default function ResponsePlanPanel({ plan: propPlan }) {
  const plan         = propPlan || MOCK_PLAN
  const assignments  = plan.assignments   || []
  const unassigned   = plan.unassigned_incidents || []

  return (
    <div className="panel">
      {/* Header */}
      <div className="panel-title flex-wrap gap-2">
        <span className="text-violet-400">📋</span>
        <span>Current Response Plan</span>
        <span className="mono text-[10px] font-normal text-slate-600 normal-case ml-1">· {plan.plan_id}</span>
        <div className="ml-auto flex items-center gap-2 normal-case">
          <span className="mono text-[10px] text-slate-600">
            CBC: <span className="text-green-400">{plan.optimization_status}</span>
          </span>
          {plan.objective_value != null && (
            <span className="mono text-[10px] text-slate-600">obj {plan.objective_value}</span>
          )}
        </div>
      </div>

      {/* Explanation */}
      <div className="border-b border-edge/60 bg-panel2/30 px-4 py-2.5">
        <p className="text-xs text-slate-500 italic leading-relaxed">{plan.explanation}</p>
      </div>

      {/* Shortage alert */}
      {unassigned.length > 0 && (
        <div className="border-b border-red-500/20 bg-red-500/5 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="animate-flash text-red-400 text-sm">⚠</span>
            <div className="text-xs">
              <span className="font-semibold text-red-300">{unassigned.length} shortage{unassigned.length > 1 ? 's' : ''}: </span>
              <span className="text-red-400/70">
                {unassigned.map(u => `${u.incident_id} (${u.missing_resources.map(pretty).join(', ')})`).join(' · ')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Assignments */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th>Incident</th>
              <th>Resource</th>
              <th>Type</th>
              <th>ETA</th>
              <th>Dist.</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map(x => {
              const st  = ASN_STATUS[x.status] || ASN_STATUS.assigned
              const ico = TYPE_ICON[x.resource_type] || '🚗'
              return (
                <tr key={x.id} title={x.reason}>
                  <td className="mono font-bold text-slate-200">{x.incident_id}</td>
                  <td className="mono font-semibold text-sky-300">{x.resource_id}</td>
                  <td>
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <span>{ico}</span>
                      {pretty(x.resource_type)}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <span style={{ color: st.color }}>⟳</span>
                      <span className="mono text-xs text-slate-300">{x.eta} min</span>
                    </div>
                  </td>
                  <td className="mono text-xs text-slate-500">{x.distance} km</td>
                  <td>
                    <span
                      className="badge"
                      style={{ color: st.color, borderColor: `${st.color}35`, background: `${st.color}10` }}
                    >
                      {st.icon} {st.label}
                    </span>
                  </td>
                </tr>
              )
            })}
            {/* Unassigned rows */}
            {unassigned.map(u => (
              <tr key={u.incident_id} className="bg-red-500/5">
                <td className="mono font-bold text-red-300">{u.incident_id}</td>
                <td colSpan="3" className="text-xs text-red-400/80">
                  ✗ Unassigned — missing: {u.missing_resources.map(pretty).join(', ')}
                </td>
                <td />
                <td>
                  <span className="badge animate-flash"
                    style={{ color: '#fca5a5', borderColor: 'rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.1)' }}>
                    ⏳ Waiting
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
