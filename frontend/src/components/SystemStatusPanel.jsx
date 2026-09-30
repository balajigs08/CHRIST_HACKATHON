import { MOCK_SYSTEM_STATUS } from '../data/mockData.js'

const STATUS_CFG = {
  operational: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.25)',  label: 'Operational', dot: 'bg-green-400' },
  degraded:    { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.25)', label: 'Degraded',    dot: 'bg-amber-400 animate-flash' },
  offline:     { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)',  label: 'Offline',     dot: 'bg-red-500 animate-flash' },
}

const AGENT_INFO = {
  incident_assessment: {
    label: 'Incident Assessment',
    icon: '🔍',
    desc: 'Text → type, severity, urgency, location, resources',
  },
  resource_allocation: {
    label: 'Resource Allocation',
    icon: '⚖',
    desc: 'PuLP + CBC MILP optimizer',
  },
  command_planning: {
    label: 'Command & Planning',
    icon: '🎯',
    desc: 'Global state, replanning, human-in-the-loop',
  },
  realtime_updates: {
    label: 'Real-Time Updates',
    icon: '📡',
    desc: 'WebSocket push to dashboard',
  },
  database: {
    label: 'MongoDB Database',
    icon: '🗄',
    desc: 'Persistence, audit log, restart recovery',
  },
}

export default function SystemStatusPanel() {
  const allOperational = Object.values(MOCK_SYSTEM_STATUS).every(s => s.status === 'operational')

  return (
    <div className="panel">
      <div className="panel-title">
        <span className="text-teal-400">⚙</span>
        <span>System Status</span>
        <div
          className="ml-auto flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold normal-case"
          style={allOperational
            ? { color: '#22c55e', borderColor: 'rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.08)' }
            : { color: '#fbbf24', borderColor: 'rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.08)' }
          }
        >
          <span className={`h-1.5 w-1.5 rounded-full ${allOperational ? 'bg-green-400' : 'bg-amber-400 animate-flash'}`} />
          {allOperational ? 'All Systems Nominal' : 'Mock Mode — Backend Offline'}
        </div>
      </div>

      <div className="grid gap-2 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {Object.entries(MOCK_SYSTEM_STATUS).map(([key, s]) => {
          const cfg  = STATUS_CFG[s.status] || STATUS_CFG.offline
          const info = AGENT_INFO[key] || { label: key, icon: '·', desc: '' }

          return (
            <div
              key={key}
              className="rounded-xl border px-4 py-3 transition-all hover:brightness-110"
              style={{ borderColor: cfg.border, background: cfg.bg }}
            >
              {/* Top row */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">{info.icon}</span>
                  <span className="text-xs font-semibold text-slate-300">{info.label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                  <span className="text-[10px] font-semibold" style={{ color: cfg.color }}>
                    {cfg.label}
                  </span>
                </div>
              </div>

              {/* Description */}
              <p className="mt-1.5 text-[11px] text-slate-600 leading-relaxed">{info.desc}</p>

              {/* Mode */}
              <p className="mt-1 mono text-[10px] text-slate-600 italic">{s.mode}</p>

              {/* Latency */}
              {s.latency_ms != null && (
                <div className="mt-2 flex items-center gap-1.5">
                  <div className="h-1 flex-1 rounded-full bg-edge overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, (s.latency_ms / 500) * 100)}%`,
                        background: s.latency_ms < 100 ? '#22c55e' : s.latency_ms < 300 ? '#fbbf24' : '#ef4444',
                      }}
                    />
                  </div>
                  <span className="mono text-[10px] text-slate-600">{s.latency_ms}ms</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Mock mode notice */}
      <div className="border-t border-edge px-4 py-2.5 text-center text-[11px] text-slate-600">
        Running in <span className="text-amber-400 font-semibold">mock / demo mode</span> — no backend required.
        Start <span className="mono text-slate-500">uvicorn main:app --port 8000</span> to go live.
      </div>
    </div>
  )
}
