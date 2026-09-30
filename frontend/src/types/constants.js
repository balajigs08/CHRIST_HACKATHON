// Shared visual + label constants (the "types" of the domain)
export const SEVERITY = {
  critical: { label: 'Critical', color: '#ef4444', badge: 'bg-red-500/20 text-red-300 border-red-500/40' },
  high:     { label: 'High',     color: '#f97316', badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40' },
  medium:   { label: 'Medium',   color: '#eab308', badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' },
  low:      { label: 'Low',      color: '#38bdf8', badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
}

export const RESOURCE_STATUS = {
  available:   { label: 'Available',   color: '#22c55e', badge: 'bg-green-500/20 text-green-300 border-green-500/40' },
  assigned:    { label: 'Assigned',    color: '#3b82f6', badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  unavailable: { label: 'Unavailable', color: '#ef4444', badge: 'bg-red-500/20 text-red-300 border-red-500/40' },
  maintenance: { label: 'Maintenance', color: '#a855f7', badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
  deploying:   { label: 'Deploying',   color: '#fbbf24', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  en_route:    { label: 'En Route',    color: '#38bdf8', badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
  on_scene:    { label: 'On Scene',    color: '#22c55e', badge: 'bg-green-500/20 text-green-300 border-green-500/40' },
}

export const RESOURCE_GLYPH = {
  ambulance:    'A',
  fire_team:    'F',
  police_unit:  'P',
  rescue_team:  'R',
  medical_unit: 'M',
  shelter:      'S',
}

export const RESOURCE_ICON = {
  ambulance:    '🚑',
  fire_team:    '🚒',
  police_unit:  '🚓',
  rescue_team:  '🪖',
  medical_unit: '🏥',
  shelter:      '⛺',
}

export const RESOURCE_TYPE_LABELS = {
  ambulance:    'Ambulance',
  fire_team:    'Fire Unit',
  police_unit:  'Police Unit',
  rescue_team:  'Rescue Team',
  medical_unit: 'Medical Team',
  shelter:      'Shelter Support',
}

export const INCIDENT_STATUS = {
  assigned: { label: 'Assigned', color: '#38bdf8', badge: 'bg-sky-500/15 text-sky-300 border-sky-500/35' },
  waiting:  { label: 'Waiting',  color: '#c084fc', badge: 'bg-purple-500/15 text-purple-300 border-purple-500/35' },
  resolved: { label: 'Resolved', color: '#4ade80', badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35' },
}

export const PLAN_STATUS = {
  active:             { label: 'Active',             color: '#22c55e', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  pending:            { label: 'Pending',            color: '#eab308', badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' },
  updated:            { label: 'Updated',            color: '#38bdf8', badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
  completed:          { label: 'Completed',          color: '#94a3b8', badge: 'bg-slate-500/20 text-slate-300 border-slate-500/40' },
  requires_attention: { label: 'Requires Attention', color: '#ef4444', badge: 'bg-red-500/20 text-red-300 border-red-500/40 animate-flash' },
}

export const INCIDENT_ICON = {
  building_fire:     '🔥',
  road_accident:     '🚗',
  medical_emergency: '❤️',
  building_collapse: '🏗',
  gas_leak:          '💨',
  flood:             '🌊',
  chemical_spill:    '🧪',
  power_outage:      '⚡',
  structural_hazard: '🚧',
  water_main_break:  '💧',
  default:           '⚠',
}

export const pretty   = s => (s || '').replaceAll('_', ' ')
export const prettyCap = s => pretty(s).replace(/\b\w/g, c => c.toUpperCase())

export const fmtTime = iso =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'

export const fmtDate = iso =>
  iso ? new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

export const timeSince = iso => {
  if (!iso) return '—'
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return `${Math.round(diff)}s ago`
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`
  return `${Math.round(diff / 3600)}h ago`
}
