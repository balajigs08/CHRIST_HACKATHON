import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { api, errorMessage } from '../services/api.js'

const INCIDENT_TYPES = [
  { value: 'road_accident', label: '🚗 Road Accident', icon: '🚗' },
  { value: 'building_fire', label: '🔥 Building Fire', icon: '🔥' },
  { value: 'medical_emergency', label: '🏥 Medical Emergency', icon: '🏥' },
  { value: 'chemical_spill', label: '☣️ Chemical Spill', icon: '☣️' },
  { value: 'flood', label: '🌊 Flood / Water Surge', icon: '🌊' },
  { value: 'gas_leak', label: '💨 Gas Leak', icon: '💨' },
]

export default function CitizenDashboard() {
  const { user, logout, setCurrentView } = useAuth()
  const [activeTab, setActiveTab] = useState('my_reports') // 'my_reports' | 'report_incident'

  // Incident form state
  const [title, setTitle] = useState('')
  const [type, setType] = useState('road_accident')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('Downtown Metro Area')
  const [latitude, setLatitude] = useState(12.9716)
  const [longitude, setLongitude] = useState(77.5946)
  const [severity, setSeverity] = useState('medium')
  const [urgency, setUrgency] = useState(6)

  // Incident list state
  const [incidents, setIncidents] = useState([])
  const [loadingIncidents, setLoadingIncidents] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState('')
  const [submitError, setSubmitError] = useState('')

  const fetchMyIncidents = async () => {
    setLoadingIncidents(true)
    try {
      const data = await api.incidents.list()
      setIncidents(data || [])
    } catch (err) {
      console.error('Failed to load user incidents', err)
    } finally {
      setLoadingIncidents(false)
    }
  }

  useEffect(() => {
    fetchMyIncidents()
    const timer = setInterval(fetchMyIncidents, 10000)
    return () => clearInterval(timer)
  }, [])

  const handleReportSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError('')
    setSubmitSuccess('')

    try {
      const payload = {
        title: title || `${type.replace('_', ' ').toUpperCase()} Report`,
        type,
        description,
        location,
        latitude: parseFloat(latitude) || 12.9716,
        longitude: parseFloat(longitude) || 77.5946,
        severity,
        urgency: parseInt(urgency, 10) || 5,
      }

      await api.incidents.create(payload)
      setSubmitSuccess('Emergency incident reported successfully. Dispatch units are being coordinated.')
      setTitle('')
      setDescription('')
      fetchMyIncidents()
      setActiveTab('my_reports')
    } catch (err) {
      setSubmitError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      {/* ── Top Header ── */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3.5 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl text-lg font-black text-white"
            style={{
              background: 'linear-gradient(135deg,#0ea5e9,#6366f1)',
              boxShadow: '0 0 16px rgba(14,165,233,0.35)',
            }}
          >
            ⚡
          </div>
          <div>
            <h1 className="text-sm font-black tracking-wider text-slate-900">CRISIS COMMAND</h1>
            <p className="text-[10px] uppercase tracking-widest text-sky-600 font-semibold">
              Citizen Emergency Portal
            </p>
          </div>
        </div>

        {/* User Info + Logout */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs font-bold text-slate-800">{user?.name || 'Citizen User'}</span>
            <span className="text-[10px] text-slate-400 font-mono">{user?.email}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              Verified
            </span>
            <button
              onClick={logout}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* ── Navigation Tabs ── */}
      <div className="border-b border-slate-200 bg-white px-6 py-2.5">
        <div className="flex items-center gap-4 max-w-5xl mx-auto">
          <button
            onClick={() => setActiveTab('my_reports')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'my_reports'
                ? 'bg-sky-50 text-sky-700 border border-sky-200'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <span>📋</span> My Reported Incidents ({incidents.length})
          </button>
          <button
            onClick={() => setActiveTab('report_incident')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'report_incident'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <span>🚨</span> Report New Emergency
          </button>
        </div>
      </div>

      {/* ── Main Content Container ── */}
      <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
        {/* ========================================================================= */}
        {/* TAB 1: MY REPORTED INCIDENTS & STATUS TRACKER                             */}
        {/* ========================================================================= */}
        {activeTab === 'my_reports' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">Your Emergency Reports</h2>
                <p className="text-xs text-slate-500">
                  Track dispatch status, AI assessment, and emergency response updates for incidents you reported.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('report_incident')}
                className="rounded-xl bg-gradient-to-r from-red-500 to-rose-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-red-500/20 hover:from-red-400 hover:to-rose-500 transition-all flex items-center gap-1.5"
              >
                <span>+</span> Report Incident
              </button>
            </div>

            {submitSuccess && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-700 flex items-center gap-2">
                <span>✓</span> {submitSuccess}
              </div>
            )}

            {loadingIncidents ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400 font-mono text-xs">
                Loading reported incidents...
              </div>
            ) : incidents.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
                <div className="text-4xl mb-3">🛡️</div>
                <h3 className="text-sm font-bold text-slate-700 mb-1">No Active Incidents Reported</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
                  You have not submitted any emergency reports. If you witness an accident or hazard, report it immediately for automated multi-agent response.
                </p>
                <button
                  onClick={() => setActiveTab('report_incident')}
                  className="rounded-xl bg-sky-50 border border-sky-200 px-5 py-2.5 text-xs font-bold text-sky-700 hover:bg-sky-100 transition-all"
                >
                  Report an Incident Now
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {incidents.map((inc) => (
                  <div
                    key={inc.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-sky-300 transition-all shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">
                          {INCIDENT_TYPES.find((t) => t.value === inc.type)?.icon || '⚠️'}
                        </span>
                        <div>
                          <h3 className="text-sm font-bold text-white capitalize">
                            {inc.title || inc.type.replace('_', ' ')}
                          </h3>
                          <p className="text-[11px] text-slate-400 font-mono">ID: {inc.id} · {inc.location}</p>
                        </div>
                      </div>

                      {/* Status Tracker Badge */}
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider ${
                            inc.status === 'resolved'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : inc.status === 'dispatched' || inc.status === 'in_progress'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200 animate-pulse'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {inc.status}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                            inc.severity === 'critical'
                              ? 'bg-red-100 text-red-700'
                              : inc.severity === 'high'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {inc.severity}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 mb-3">{inc.description || 'No description provided.'}</p>

                    <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-slate-400">
                      <span>Coordinates: {inc.latitude.toFixed(4)}, {inc.longitude.toFixed(4)}</span>
                      <span>Urgency: {inc.urgency}/10</span>
                      {inc.required_resources && inc.required_resources.length > 0 && (
                        <span>Required Fleet: {inc.required_resources.join(', ')}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: REPORT NEW EMERGENCY FORM                                         */}
        {/* ========================================================================= */}
        {activeTab === 'report_incident' && (
          <div className="max-w-2xl mx-auto">
            <div className="mb-6">
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span>🚨</span> Report Emergency Incident
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Your report will be immediately ingested by the Incident Assessment Agent and matched with the nearest emergency fleet.
              </p>
            </div>

            {submitError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-start gap-2">
                <span>⚠️</span> {submitError}
              </div>
            )}

            <form onSubmit={handleReportSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Emergency Type</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {INCIDENT_TYPES.map((t) => (
                    <button
                      type="button"
                      key={t.value}
                      onClick={() => setType(t.value)}
                      className={`flex items-center gap-2 p-3 rounded-xl text-xs font-bold border transition-all text-left ${
                        type === t.value
                          ? 'bg-sky-50 border-sky-400 text-sky-700 shadow-sm'
                          : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300'
                      }`}
                    >
                      <span>{t.icon}</span>
                      <span>{t.label.split(' ')[1]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Incident Title / Brief</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Multi-vehicle collision near Main St"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Detailed Description</label>
                <textarea
                  rows={3}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe trapped victims, smoke, chemical hazard, injuries, or roadway blockages..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Location Name</label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Downtown Metro Station"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Assessed Severity</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-sky-500 focus:outline-none"
                  >
                    <option value="critical">🔴 Critical (Immediate Life Threat)</option>
                    <option value="high">🟠 High (Severe Hazard / Injury)</option>
                    <option value="medium">🟡 Medium (Moderate Emergency)</option>
                    <option value="low">🟢 Low (Minor Incident)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-gradient-to-r from-red-500 to-rose-600 py-3.5 text-sm font-bold text-white shadow-xl shadow-red-500/30 hover:from-red-400 hover:to-rose-500 transition-all disabled:opacity-50"
                >
                  {submitting ? 'Submitting & Dispatching...' : 'Submit Emergency Report'}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  )
}
