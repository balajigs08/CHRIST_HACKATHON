import { useState, useEffect } from 'react'
import { SEVERITY, INCIDENT_ICON, pretty, prettyCap } from '../types/constants.js'

const INCIDENT_TYPES = [
  'building_fire',
  'road_accident',
  'medical_emergency',
  'building_collapse',
  'gas_leak',
  'flood',
  'chemical_spill',
  'power_outage',
  'structural_hazard',
  'water_main_break',
]

const AVAILABLE_RESOURCES = [
  { id: 'ambulance',    label: 'Ambulance (ALS/BLS)', icon: '🚑' },
  { id: 'fire_team',    label: 'Fire Team (HazMat/Engine)', icon: '🚒' },
  { id: 'rescue_team',  label: 'Rescue Team (USAR/Water)', icon: '🪖' },
  { id: 'medical_unit', label: 'Mobile Medical Unit (ICU/Trauma)', icon: '🏥' },
  { id: 'shelter',      label: 'Emergency Shelter Support', icon: '⛺' },
]

export default function CreateIncidentModal({ isOpen, onClose, onCreate }) {
  const [type, setType] = useState('building_fire')
  const [locationName, setLocationName] = useState('')
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState('high')
  const [urgency, setUrgency] = useState(7)
  const [requiredResources, setRequiredResources] = useState(['fire_team'])
  const [latitude, setLatitude] = useState(12.9716)
  const [longitude, setLongitude] = useState(77.5946)
  const [error, setError] = useState('')

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleResourceToggle = (resId) => {
    setRequiredResources((prev) =>
      prev.includes(resId) ? prev.filter((r) => r !== resId) : [...prev, resId]
    )
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')

    if (!locationName.trim()) {
      setError('Please provide a specific location or landmark.')
      return
    }

    if (!description.trim()) {
      setError('Please provide a brief description of the incident.')
      return
    }

    if (requiredResources.length === 0) {
      setError('Please select at least one required resource type.')
      return
    }

    const now = new Date().toISOString()
    const newIncident = {
      id: `INC${String(Math.floor(100 + Math.random() * 900))}`,
      type,
      location_name: locationName.trim(),
      description: description.trim(),
      severity,
      urgency: Number(urgency),
      status: 'waiting',
      required_resources: requiredResources,
      missing_resources: [...requiredResources],
      waiting_time: 0,
      created_at: now,
      latitude: parseFloat(latitude) || 12.9716,
      longitude: parseFloat(longitude) || 77.5946,
      assigned_resources: [],
      timeline: [
        {
          time: now,
          title: 'Incident Registered',
          description: `Emergency incident dispatched with ${severity.toUpperCase()} severity. Awaiting fleet allocation.`,
          actor: 'Command Dispatch (Operator)',
        },
      ],
    }

    onCreate(newIncident)
    onClose()
  }

  const sev = SEVERITY[severity] || SEVERITY.high

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 transition-all">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} aria-label="Close modal overlay" />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-xl rounded-2xl border border-edge bg-surface shadow-2xl overflow-hidden slide-up max-h-[90vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-edge bg-panel px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/30 text-lg">
              🚨
            </span>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">Report New Incident</h3>
              <p className="mono text-[11px] text-slate-400 mt-0.5">Crisis Command Rapid Dispatch Form</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-edge-2 bg-panel2 text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300 flex items-center gap-2">
              <span>⚠</span>
              <span>{error}</span>
            </div>
          )}

          {/* Type & Severity row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Incident Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="input cursor-pointer"
              >
                {INCIDENT_TYPES.map((t) => (
                  <option key={t} value={t} className="bg-panel text-slate-200">
                    {INCIDENT_ICON[t] || '⚠'} {prettyCap(t)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Severity Level
              </label>
              <div className="grid grid-cols-4 gap-1">
                {['critical', 'high', 'medium', 'low'].map((s) => {
                  const isSelected = severity === s
                  const sInfo = SEVERITY[s]
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSeverity(s)}
                      className={`rounded-lg py-2 text-xs font-semibold uppercase border transition-all ${
                        isSelected
                          ? 'border-transparent shadow-lg text-white'
                          : 'border-edge bg-panel2/60 text-slate-500 hover:text-slate-300'
                      }`}
                      style={isSelected ? { backgroundColor: sInfo.color } : {}}
                    >
                      {s}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Urgency Slider */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Priority Urgency Score
              </label>
              <span className={`mono text-xs font-bold ${urgency >= 8 ? 'text-red-400' : 'text-amber-400'}`}>
                {urgency} / 10
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={urgency}
              onChange={(e) => setUrgency(e.target.value)}
              className="w-full accent-sky-400 cursor-pointer"
            />
          </div>

          {/* Location Name */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Location / Landmark Address <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. MG Road Metro Station, Bengaluru"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              className="input"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Incident Situation Report <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="Detailed description of the emergency event, casualties, or immediate hazards..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input resize-none"
            />
          </div>

          {/* Required Resources */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Required Resources <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {AVAILABLE_RESOURCES.map((res) => {
                const checked = requiredResources.includes(res.id)
                return (
                  <button
                    key={res.id}
                    type="button"
                    onClick={() => handleResourceToggle(res.id)}
                    className={`flex items-center gap-2.5 rounded-lg border p-2.5 text-left text-xs transition-all ${
                      checked
                        ? 'border-sky-500/50 bg-sky-500/15 text-sky-200'
                        : 'border-edge bg-panel2/40 text-slate-400 hover:bg-panel2/80'
                    }`}
                  >
                    <span className="text-sm">{res.icon}</span>
                    <span className="flex-1 font-medium">{res.label}</span>
                    <span className={`text-xs ${checked ? 'text-sky-400 font-bold' : 'text-slate-600'}`}>
                      {checked ? '✓' : '+'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Geo Coordinates (collapsible/secondary) */}
          <div className="pt-2 border-t border-edge">
            <details className="text-xs text-slate-500 group">
              <summary className="cursor-pointer font-medium hover:text-slate-400 flex items-center justify-between">
                <span>Tactical GPS Coordinates (Optional)</span>
                <span className="group-open:rotate-180 transition-transform">▾</span>
              </summary>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    className="input text-xs mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    className="input text-xs mono"
                  />
                </div>
              </div>
            </details>
          </div>

          {/* Modal Footer actions */}
          <div className="pt-4 border-t border-edge flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn px-4 py-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary px-5 py-2 text-xs flex items-center gap-2"
            >
              <span>🚨</span>
              <span>Deploy Incident</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  )
}
