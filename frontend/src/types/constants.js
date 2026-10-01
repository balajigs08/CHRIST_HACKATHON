// Shared visual + label constants (the "types" of the domain)
export const SEVERITY = {
  critical: { label: 'Critical', color: '#dc2626', badge: 'bg-red-50 text-red-700 border-red-200 font-bold' },
  high:     { label: 'High',     color: '#ea580c', badge: 'bg-orange-50 text-orange-700 border-orange-200 font-bold' },
  medium:   { label: 'Medium',   color: '#d97706', badge: 'bg-amber-50 text-amber-700 border-amber-200 font-bold' },
  low:      { label: 'Low',      color: '#0284c7', badge: 'bg-sky-50 text-sky-700 border-sky-200 font-bold' },
}

export const RESOURCE_STATUS = {
  available:   { label: 'Available',   color: '#16a34a', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold' },
  assigned:    { label: 'Assigned',    color: '#0284c7', badge: 'bg-sky-50 text-sky-700 border-sky-200 font-bold' },
  unavailable: { label: 'Unavailable', color: '#dc2626', badge: 'bg-red-50 text-red-700 border-red-200 font-bold' },
  maintenance: { label: 'Maintenance', color: '#7c3aed', badge: 'bg-purple-50 text-purple-700 border-purple-200 font-bold' },
  deploying:   { label: 'Deploying',   color: '#d97706', badge: 'bg-amber-50 text-amber-700 border-amber-200 font-bold' },
  en_route:    { label: 'En Route',    color: '#0284c7', badge: 'bg-sky-50 text-sky-700 border-sky-200 font-bold' },
  on_scene:    { label: 'On Scene',    color: '#16a34a', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold' },
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
  assigned: { label: 'Assigned', color: '#0284c7', badge: 'bg-sky-50 text-sky-700 border-sky-200 font-bold' },
  waiting:  { label: 'Waiting',  color: '#7c3aed', badge: 'bg-purple-50 text-purple-700 border-purple-200 font-bold' },
  resolved: { label: 'Resolved', color: '#16a34a', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold' },
}

export const PLAN_STATUS = {
  active:             { label: 'Active',             color: '#16a34a', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold' },
  pending:            { label: 'Pending',            color: '#d97706', badge: 'bg-amber-50 text-amber-700 border-amber-200 font-bold' },
  updated:            { label: 'Updated',            color: '#0284c7', badge: 'bg-sky-50 text-sky-700 border-sky-200 font-bold' },
  completed:          { label: 'Completed',          color: '#64748b', badge: 'bg-slate-100 text-slate-700 border-slate-200 font-bold' },
  requires_attention: { label: 'Requires Attention', color: '#dc2626', badge: 'bg-red-50 text-red-700 border-red-200 font-bold animate-flash' },
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
