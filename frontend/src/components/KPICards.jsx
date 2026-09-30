import { MOCK_SUMMARY, MOCK_RESOURCES, MOCK_APPROVALS } from '../data/mockData.js'

export default function KPICards({ summary, incidents, resources, approvals }) {
  const cards = [
    {
      key: 'critical', label: 'Critical Incidents', icon: '🔴',
      color: '#ef4444', glow: 'rgba(239,68,68,0.18)',
      border: 'rgba(239,68,68,0.25)', bg: 'rgba(239,68,68,0.06)',
      value: incidents
        ? incidents.filter(i => i.severity === 'critical' && i.status !== 'resolved').length
        : (summary?.critical ?? MOCK_SUMMARY.critical),
      sub: 'Immediate response needed',
    },
    {
      key: 'high', label: 'High Priority', icon: '🟠',
      color: '#f97316', glow: 'rgba(249,115,22,0.15)',
      border: 'rgba(249,115,22,0.25)', bg: 'rgba(249,115,22,0.06)',
      value: incidents
        ? incidents.filter(i => i.severity === 'high' && i.status !== 'resolved').length
        : (summary?.high ?? MOCK_SUMMARY.high),
      sub: 'Elevated urgency',
    },
    {
      key: 'active', label: 'Active Incidents', icon: '⚡',
      color: '#38bdf8', glow: 'rgba(56,189,248,0.12)',
      border: 'rgba(56,189,248,0.2)', bg: 'rgba(56,189,248,0.05)',
      value: incidents
        ? incidents.filter(i => i.status !== 'resolved').length
        : (summary?.active ?? MOCK_SUMMARY.active),
      sub: 'Total in progress',
    },
    {
      key: 'waiting', label: 'Waiting Resources', icon: '⏳',
      color: '#a78bfa', glow: 'rgba(167,139,250,0.15)',
      border: 'rgba(167,139,250,0.25)', bg: 'rgba(167,139,250,0.06)',
      value: incidents
        ? incidents.filter(i => i.status === 'waiting').length
        : (summary?.waiting ?? MOCK_SUMMARY.waiting),
      sub: 'Pending assignment',
    },
    {
      key: 'available', label: 'Available Resources', icon: '✅',
      color: '#22c55e', glow: 'rgba(34,197,94,0.12)',
      border: 'rgba(34,197,94,0.2)', bg: 'rgba(34,197,94,0.05)',
      value: resources
        ? resources.filter(r => r.status === 'available').length
        : MOCK_RESOURCES.filter(r => r.status === 'available').length,
      sub: 'Ready to deploy',
    },
    {
      key: 'assigned', label: 'Assigned Resources', icon: '🔵',
      color: '#3b82f6', glow: 'rgba(59,130,246,0.12)',
      border: 'rgba(59,130,246,0.2)', bg: 'rgba(59,130,246,0.05)',
      value: resources
        ? resources.filter(r => r.status === 'assigned').length
        : MOCK_RESOURCES.filter(r => r.status === 'assigned').length,
      sub: 'Currently dispatched',
    },
    {
      key: 'unavailable', label: 'Unavailable Resources', icon: '🔴',
      color: '#dc2626', glow: 'rgba(220,38,38,0.12)',
      border: 'rgba(220,38,38,0.2)', bg: 'rgba(220,38,38,0.05)',
      value: resources
        ? resources.filter(r => r.status === 'unavailable' || r.status === 'maintenance').length
        : MOCK_RESOURCES.filter(r => r.status === 'unavailable' || r.status === 'maintenance').length,
      sub: 'Offline or maintenance',
    },
    {
      key: 'attention', label: 'Human Attention', icon: '👤',
      color: '#fbbf24', glow: 'rgba(251,191,36,0.18)',
      border: 'rgba(251,191,36,0.3)', bg: 'rgba(251,191,36,0.07)',
      value: approvals
        ? approvals.filter(a => a.status === 'pending').length
        : MOCK_APPROVALS.filter(a => a.status === 'pending').length,
      sub: 'Approvals required',
      alert: true,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
      {cards.map(c => {
        const val     = c.value
        const isAlert = c.alert && val > 0

        return (
          <div
            key={c.key}
            className="relative overflow-hidden rounded-xl border p-4 transition-all hover:scale-[1.02] cursor-default"
            style={{
              borderColor: c.border,
              background: c.bg,
              boxShadow: val > 0 ? `0 4px 20px ${c.glow}` : undefined,
            }}
          >
            {/* Top row */}
            <div className="flex items-start justify-between gap-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 leading-tight">
                {c.label}
              </p>
              <span className="text-base flex-shrink-0">{c.icon}</span>
            </div>

            {/* Value */}
            <p
              className={`mt-2 text-3xl font-black leading-none ${isAlert ? 'animate-flash' : ''}`}
              style={{ color: val > 0 ? c.color : '#334155' }}
            >
              {val}
            </p>

            {/* Sub-label */}
            <p className="mt-1.5 text-[10px] text-slate-600 leading-tight">{c.sub}</p>

            {/* Alert indicator */}
            {isAlert && (
              <div
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ background: c.color, opacity: 0.7 }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
