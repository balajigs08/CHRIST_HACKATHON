const NAV_ITEMS = [
  { id: 'dashboard',       label: 'Dashboard',       icon: HomeIcon },
  { id: 'incidents',       label: 'Incidents',        icon: WarningIcon },
  { id: 'resources',       label: 'Resources',        icon: TruckIcon },
  { id: 'map',             label: 'Live Map',         icon: MapIcon },
  { id: 'plan',            label: 'Response Plans',   icon: ClipboardIcon },
  { id: 'reallocation',    label: 'Reallocation',     icon: ShuffleIcon },
  { id: 'events',          label: 'Events',           icon: ListIcon },
  { id: 'alerts',          label: 'Alerts',           icon: BellIcon },
  { id: 'simulation',      label: 'Simulation',       icon: PlayIcon },
]

export default function Sidebar({ activeTab, onTabChange, pendingApprovals = 0, criticalCount = 0 }) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col w-56 flex-shrink-0 border-r border-edge bg-surface/80 backdrop-blur-xl"
        style={{ minHeight: 'calc(100vh - 57px)' }}
      >
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {NAV_ITEMS.map(item => {
            const Icon   = item.icon
            const isActive = activeTab === item.id
            const badge  =
              item.id === 'alerts'    ? pendingApprovals :
              item.id === 'incidents' ? criticalCount    : 0

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`group relative w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all text-left ${
                  isActive
                    ? 'bg-gradient-to-r from-sky-500/15 to-blue-500/10 text-sky-300 border border-sky-500/20'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-panel/60'
                }`}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-sky-400" />
                )}

                <Icon
                  className="flex-shrink-0 transition-colors"
                  size={16}
                  color={isActive ? '#38bdf8' : 'currentColor'}
                />
                <span>{item.label}</span>

                {badge > 0 && (
                  <span
                    className={`ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                      item.id === 'alerts' ? 'bg-red-500/20 text-red-300 animate-flash' : 'bg-orange-500/20 text-orange-300'
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Bottom info */}
        <div className="border-t border-edge px-4 py-3">
          <p className="text-[10px] text-slate-700 font-mono uppercase tracking-widest">v1.0.0 · Mock</p>
          <p className="text-[10px] text-slate-700 mt-0.5">GATEWAYS 2026</p>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center overflow-x-auto border-t border-edge bg-surface/95 backdrop-blur-xl px-2 py-1 gap-1">
        {NAV_ITEMS.map(item => {
          const Icon     = item.icon
          const isActive = activeTab === item.id
          const badge    =
            item.id === 'alerts'    ? pendingApprovals :
            item.id === 'incidents' ? criticalCount    : 0

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`relative flex flex-shrink-0 flex-col items-center gap-0.5 px-3 py-1.5 min-w-[62px] rounded-xl text-[10px] font-medium transition-colors ${
                isActive ? 'text-sky-300 bg-sky-500/10' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon size={16} color={isActive ? '#38bdf8' : 'currentColor'} />
              <span className="truncate max-w-[58px]">{item.label.split(' ')[0]}</span>
              {badge > 0 && (
                <span className="absolute top-1 right-2 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-black text-white">
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>
    </>
  )
}

// ── SVG Icon Components ───────────────────────────────────────────────────────

function HomeIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9,22 9,12 15,12 15,22" />
    </svg>
  )
}

function WarningIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function TruckIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" />
      <polygon points="16,8 20,8 23,11 23,16 16,16 16,8" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  )
}

function MapIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="1,6 1,22 8,18 16,22 23,18 23,2 16,6 8,2 1,6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  )
}

function ClipboardIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="15" y2="16" />
    </svg>
  )
}

function ListIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
}

function BellIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  )
}

function PlayIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5,3 19,12 5,21 5,3" />
    </svg>
  )
}

function ShuffleIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" />
      <line x1="15" y1="15" x2="21" y2="21" />
      <line x1="4" y1="4" x2="9" y2="9" />
    </svg>
  )
}
