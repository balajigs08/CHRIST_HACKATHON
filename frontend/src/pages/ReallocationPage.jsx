import { useState } from 'react'
import { MOCK_REALLOCATIONS, MOCK_INCIDENTS, MOCK_RESOURCES } from '../data/mockData.js'
import { fmtTime, fmtDate, timeSince, pretty, prettyCap } from '../types/constants.js'

export default function ReallocationPage({ onNavigate }) {
  const [selectedEventId, setSelectedEventId] = useState(MOCK_REALLOCATIONS[0].id)
  const [acknowledged, setAcknowledged] = useState({})
  const [toast, setToast] = useState(null)
  const [activeTab, setActiveTab] = useState('all') // 'all' | 'comparison' | 'why' | 'affected' | 'timeline'

  const currentEvent = MOCK_REALLOCATIONS.find((e) => e.id === selectedEventId) || MOCK_REALLOCATIONS[0]
  const isAck = !!acknowledged[currentEvent.id]

  const showToast = (message, type = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  const handleAcknowledge = () => {
    setAcknowledged((prev) => ({ ...prev, [currentEvent.id]: true }))
    showToast(`Reallocation ${currentEvent.id} signed off by Commander. Plan ${currentEvent.plan_id} verified.`, 'success')
  }

  const handleViewPlan = () => {
    if (typeof onNavigate === 'function') {
      onNavigate('plan')
    } else {
      showToast(`Navigating to Response Plan ${currentEvent.plan_id}...`, 'info')
    }
  }

  return (
    <div className="space-y-5 animate-fade-in pb-12">
      {/* ── Toast Notification ── */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border border-sky-500/30 bg-surface/95 px-4 py-3 shadow-2xl backdrop-blur-xl animate-fade-in">
          <span className="text-base">{toast.type === 'success' ? '✅' : 'ℹ️'}</span>
          <span className="text-sm font-medium text-slate-200">{toast.message}</span>
        </div>
      )}

      {/* ── Top Header & Event Selector ── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-edge/60 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="badge border border-purple-500/30 bg-purple-500/10 text-purple-300 font-mono text-xs">
              ⚡ REALLOCATION INTELLIGENCE
            </span>
            <span className="text-xs text-slate-500 font-mono">Plan {currentEvent.plan_id}</span>
            <span className="text-slate-600">·</span>
            <span className="text-xs text-slate-500">{fmtTime(currentEvent.timestamp)} ({timeSince(currentEvent.timestamp)})</span>
          </div>
          <h1 className="text-xl lg:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span>{currentEvent.title}</span>
          </h1>
          <p className="text-xs lg:text-sm text-slate-400 mt-1 max-w-3xl">
            Automated CBC optimizer event breakdown · Detailed rationale, before vs after comparative telemetry, and impact analysis for tactical unit re-routing.
          </p>
        </div>

        {/* Top Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleViewPlan}
            className="flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-xs lg:text-sm font-semibold text-sky-300 transition-all hover:bg-sky-500/20 hover:border-sky-500/50 shadow-sm shadow-sky-500/10"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <span>View Response Plan</span>
          </button>

          <button
            onClick={handleAcknowledge}
            disabled={isAck}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs lg:text-sm font-semibold transition-all ${
              isAck
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30'
            }`}
          >
            <span>{isAck ? '✓ Commander Signed Off' : 'Acknowledge Reallocation'}</span>
          </button>
        </div>
      </div>

      {/* ── Event Selector Pills ── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">Select Event:</span>
        {MOCK_REALLOCATIONS.map((evt) => {
          const isSelected = evt.id === selectedEventId
          return (
            <button
              key={evt.id}
              onClick={() => setSelectedEventId(evt.id)}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-medium transition-all ${
                isSelected
                  ? 'bg-slate-800 text-sky-300 border border-sky-500/40 shadow-sm shadow-sky-500/10'
                  : 'bg-panel/70 text-slate-400 border border-edge hover:bg-panel hover:text-slate-200'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${evt.priority === 'critical' ? 'bg-red-400 animate-pulse' : 'bg-orange-400'}`} />
              <span className="font-mono font-bold">{evt.id}</span>
              <span className="text-slate-400 hidden sm:inline">· {evt.affected_incident_name.split('-')[0]}</span>
            </button>
          )
        })}
      </div>

      {/* ── Required Badges Bar ── */}
      <div className="flex flex-wrap items-center gap-2.5 p-3 rounded-2xl border border-edge/60 bg-surface/60 backdrop-blur-md">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1.5">
          <span>🏷️</span> Status Badges:
        </span>

        {/* 1. Reallocated Badge */}
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30 shadow-sm shadow-sky-500/10">
          <span className="text-sm">🔄</span> Reallocated
        </span>

        {/* 2. Critical Badge */}
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-red-500/15 text-red-300 border border-red-500/40 shadow-sm shadow-red-500/10">
          <span className="h-2 w-2 rounded-full bg-red-400 animate-pulse" /> Critical Priority
        </span>

        {/* 3. Requires Attention Badge */}
        {currentEvent.requires_attention && !isAck ? (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/40 animate-pulse">
            <span>⚠️</span> Requires Attention ({currentEvent.approval_id || 'Pending'})
          </span>
        ) : (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <span>✓</span> Attention Acknowledged
          </span>
        )}

        {/* 4. Updated Badge */}
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
          <span>⟳</span> Plan Updated ({currentEvent.plan_id})
        </span>

        <span className="ml-auto text-xs text-slate-500 font-mono hidden md:inline">
          Optimizer: Branch & Cut (CBC v2.10)
        </span>
      </div>

      {/* ── Impact Summary Cards (Requirement 7) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Metric 1: Incidents Affected */}
        <div className="panel p-3.5 relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Incidents Affected</span>
            <span className="text-base">📍</span>
          </div>
          <div className="mt-1 text-2xl font-black text-white">
            {currentEvent.impact_summary.incidents_affected}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 flex items-center gap-1">
            <span className="text-red-400 font-bold">{currentEvent.affected_incident_id}</span>
            <span>&amp;</span>
            <span className="text-amber-400 font-bold">{currentEvent.donor_incident_id}</span>
          </div>
        </div>

        {/* Metric 2: Resources Changed */}
        <div className="panel p-3.5 relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Resources Changed</span>
            <span className="text-base">🚒</span>
          </div>
          <div className="mt-1 text-2xl font-black text-white">
            {currentEvent.impact_summary.resources_changed}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-mono">
            {currentEvent.previous_resource_id} → {currentEvent.new_resource_id}
          </div>
        </div>

        {/* Metric 3: ETA Change */}
        <div className="panel p-3.5 relative overflow-hidden group border-emerald-500/30 bg-emerald-500/05">
          <div className="flex items-center justify-between text-emerald-400 text-xs font-medium">
            <span>ETA Net Impact</span>
            <span className="text-base">⏱️</span>
          </div>
          <div className="mt-1 text-2xl font-black text-emerald-300">
            {currentEvent.impact_summary.eta_change.split('/')[0]}
          </div>
          <div className="mt-1 text-[11px] text-emerald-400/80">
            {currentEvent.impact_summary.net_risk_reduction}
          </div>
        </div>

        {/* Metric 4: Human Attention Required */}
        <div className={`panel p-3.5 relative overflow-hidden group ${currentEvent.impact_summary.human_attention_required && !isAck ? 'border-amber-500/40 bg-amber-500/08' : 'border-slate-800'}`}>
          <div className="flex items-center justify-between text-xs font-medium">
            <span className={currentEvent.impact_summary.human_attention_required && !isAck ? 'text-amber-400' : 'text-slate-500'}>
              Human Attention
            </span>
            <span className="text-base">{currentEvent.impact_summary.human_attention_required && !isAck ? '⚠️' : '🛡️'}</span>
          </div>
          <div className={`mt-1 text-2xl font-black ${currentEvent.impact_summary.human_attention_required && !isAck ? 'text-amber-300' : 'text-slate-300'}`}>
            {currentEvent.impact_summary.human_attention_required && !isAck ? 'Required' : 'Clear'}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {currentEvent.approval_id ? `Action Ticket ${currentEvent.approval_id}` : 'Autonomous Authorization'}
          </div>
        </div>
      </div>

      {/* ── Event Overview Header Card (Requirement 2) ── */}
      <div className="panel p-4 lg:p-5 border-l-4 border-l-sky-500 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-edge/60 pb-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-sky-400">Resource Reallocation Event</div>
            <h2 className="text-lg font-bold text-white mt-0.5">{currentEvent.affected_incident_name}</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Time of Change:</span>
            <span className="badge font-mono bg-slate-800 text-slate-200 border-edge text-xs">
              {fmtTime(currentEvent.timestamp)}
            </span>
            <span className="badge bg-red-500/15 text-red-300 border-red-500/30 text-xs font-bold">
              {currentEvent.priority.toUpperCase()} SEVERITY
            </span>
          </div>
        </div>

        {/* Core Transfer Summary Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <div className="rounded-xl border border-edge bg-surface/40 p-3">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Previous Resource</div>
            <div className="mt-1 font-bold text-slate-300 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-400" />
              <span>{currentEvent.previous_resource_name}</span>
            </div>
            <div className="mt-1 text-xs text-red-400/90 font-mono">
              Unit {currentEvent.previous_resource_id} (Unavailable)
            </div>
          </div>

          <div className="rounded-xl border border-sky-500/30 bg-sky-500/05 p-3">
            <div className="text-[11px] font-semibold text-sky-400 uppercase tracking-wide">New Reallocated Resource</div>
            <div className="mt-1 font-bold text-white flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>{currentEvent.new_resource_name}</span>
            </div>
            <div className="mt-1 text-xs text-sky-300 font-mono">
              Unit {currentEvent.new_resource_id} (Rerouted En Route)
            </div>
          </div>

          <div className="rounded-xl border border-edge bg-surface/40 p-3">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Reason for Change</div>
            <p className="mt-1 text-xs text-slate-300 leading-relaxed line-clamp-2">
              {currentEvent.reason_for_change}
            </p>
          </div>
        </div>
      </div>

      {/* ── Section 3: "Before vs After" Comparison (Requirement 3) ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <span>⚖️</span> Before vs After State Comparison
          </h3>
          <span className="text-xs text-slate-500 font-mono">Plan PLN005 → Plan {currentEvent.plan_id}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* ── BEFORE CARD ── */}
          <div className="panel p-4 border-slate-700/60 bg-gradient-to-b from-surface/90 to-surface/40 relative">
            <div className="flex items-center justify-between border-b border-edge/60 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-800 text-xs font-mono font-bold text-slate-400 border border-edge">
                  1
                </span>
                <span className="text-sm font-black text-slate-300 uppercase tracking-wide">BEFORE REALLOCATION</span>
              </div>
              <span className="badge bg-slate-800 text-slate-400 border-edge text-[11px] font-mono">
                Original Plan Baseline
              </span>
            </div>

            <div className="space-y-3">
              {currentEvent.before.map((item, idx) => (
                <div key={idx} className="rounded-xl border border-edge/80 bg-slate-900/60 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <span className="font-mono text-sky-400">{item.incident_id}</span>
                      <span>{item.incident_name}</span>
                    </span>
                    <span className={`badge text-[10px] font-bold ${item.severity === 'critical' ? 'bg-red-500/20 text-red-300 border-red-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'}`}>
                      {item.severity.toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">Assigned Resource</div>
                      <div className="font-medium text-slate-300 truncate mt-0.5">{item.assigned_resource}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">Estimated Arrival (ETA)</div>
                      <div className="font-bold text-amber-400 font-mono mt-0.5">{item.eta}</div>
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">Status</div>
                    <div className="text-xs text-red-300 font-medium flex items-center gap-1.5 mt-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                      <span>{item.status}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── AFTER CARD ── */}
          <div className="panel p-4 border-sky-500/40 bg-gradient-to-b from-sky-950/20 to-surface/40 relative">
            <div className="flex items-center justify-between border-b border-sky-500/20 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-500/20 text-xs font-mono font-bold text-sky-300 border border-sky-500/40">
                  2
                </span>
                <span className="text-sm font-black text-sky-300 uppercase tracking-wide">AFTER REALLOCATION</span>
              </div>
              <span className="badge bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[11px] font-mono font-bold">
                Optimized Live Plan
              </span>
            </div>

            <div className="space-y-3">
              {currentEvent.after.map((item, idx) => (
                <div key={idx} className="rounded-xl border border-sky-500/30 bg-slate-900/80 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span className="font-mono text-sky-400">{item.incident_id}</span>
                      <span>{item.incident_name}</span>
                    </span>
                    <span className="badge text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                      RESOLVED DELAY
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">New Resource</div>
                      <div className="font-semibold text-emerald-300 truncate mt-0.5">{item.new_resource}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">Estimated Arrival (ETA)</div>
                      <div className="font-bold text-emerald-400 font-mono mt-0.5 flex items-center gap-1">
                        <span>{item.eta}</span>
                        {item.eta_minutes <= 4 && (
                          <span className="text-[10px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300">Fast</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-0.5">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">Status</div>
                      <div className="text-xs text-sky-300 font-medium flex items-center gap-1.5 mt-0.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                        <span>{item.status}</span>
                      </div>
                    </div>
                  </div>

                  {item.note && (
                    <div className="rounded-lg bg-sky-500/10 border border-sky-500/20 px-2.5 py-1 text-[11px] text-sky-300">
                      ℹ️ {item.note}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 4: "Why was this changed?" (Requirement 4) ── */}
      <div className="panel p-4 lg:p-5 space-y-4">
        <div className="border-b border-edge/60 pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>🧠</span> Why Was This Resource Changed?
            </h3>
            <span className="badge font-mono text-xs bg-purple-500/10 text-purple-300 border-purple-500/30">
              Autonomous Optimization Decision
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            {currentEvent.why_changed.summary}
          </p>
        </div>

        {/* 4 Required Explanatory Criteria Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {currentEvent.why_changed.reasons.map((reason, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-edge bg-surface/50 p-4 transition-all hover:border-slate-600 hover:bg-surface/80"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-slate-800 text-lg border border-edge">
                  {reason.icon}
                </span>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{reason.title}</span>
                    <span className="badge text-[10px] bg-slate-800 text-slate-300 border-edge font-semibold">
                      {reason.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {reason.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Mathematical formulation footnote */}
        <div className="rounded-xl border border-edge/60 bg-slate-900/60 p-3 text-xs text-slate-400 flex items-start gap-2.5">
          <span className="text-sm mt-0.5">📐</span>
          <div>
            <span className="font-semibold text-slate-300">Optimization Metric: </span>
            <span>
              CBC Solver objective minimized: <code className="font-mono text-sky-300">∑(Urgency × ETA) + Penalty(Unassigned Trapped Victims)</code>. 
              The marginal utility gain of moving {currentEvent.new_resource_id} to {currentEvent.affected_incident_id} (+52% survival probability) exceeded the slight delay penalty at {currentEvent.donor_incident_id}.
            </span>
          </div>
        </div>
      </div>

      {/* ── Section 5: Affected Incidents & Resources (Requirement 5) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Affected Incidents Card */}
        <div className="panel p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-edge/60 pb-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <span>📍</span> Affected Incidents ({currentEvent.affected_entities.incidents.length})
            </h4>
            <span className="text-[11px] text-slate-500">Target &amp; Donor Sites</span>
          </div>

          <div className="space-y-2.5">
            {currentEvent.affected_entities.incidents.map((inc) => (
              <div key={inc.id} className="rounded-xl border border-edge bg-surface/50 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-sky-400">{inc.id}</span>
                    <span className="text-xs font-semibold text-white">{inc.name}</span>
                  </div>
                  <span className={`badge text-[10px] font-bold ${inc.severity === 'critical' ? 'bg-red-500/20 text-red-300 border-red-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'}`}>
                    {inc.severity.toUpperCase()} (Urgency {inc.urgency})
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-1">
                  <span>Location:</span>
                  <span className="text-slate-200">{inc.location}</span>
                </div>
                <div className="rounded-lg bg-slate-900/60 p-2 text-xs text-slate-300 border border-edge/40">
                  <span className="font-semibold text-slate-400">Impact Assessment: </span>
                  {inc.impact}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Affected Resources Card */}
        <div className="panel p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-edge/60 pb-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <span>🚒</span> Affected Units &amp; Fleet ({currentEvent.affected_entities.resources.length})
            </h4>
            <span className="text-[11px] text-slate-500">Fleet Operations</span>
          </div>

          <div className="space-y-2.5">
            {currentEvent.affected_entities.resources.map((res) => (
              <div key={res.id} className="rounded-xl border border-edge bg-surface/50 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-emerald-400">{res.id}</span>
                    <span className="text-xs font-semibold text-white">{res.name}</span>
                  </div>
                  <span className={`badge text-[10px] font-bold ${res.status === 'assigned' ? 'bg-sky-500/20 text-sky-300 border-sky-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'}`}>
                    {res.status.toUpperCase()}
                  </span>
                </div>
                <div className="text-xs text-sky-300 font-medium">
                  {res.role}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5 border-t border-edge/40">
                  <span>Base/GPS: {res.location}</span>
                  <span className="font-mono text-slate-500">{res.contact}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Section 6: Reallocation Timeline (Requirement 6) ── */}
      <div className="panel p-4 lg:p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-edge/60 pb-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <span>⏱️</span> Chronological Reallocation Timeline
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              From trigger alarm to plan publication and field radio dispatch
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">5 Telemetry Milestones</span>
        </div>

        {/* Visual Vertical Timeline */}
        <div className="relative pl-6 lg:pl-8 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-edge">
          {currentEvent.timeline.map((item, idx) => (
            <div key={idx} className="relative group">
              {/* Dot icon */}
              <div className="absolute -left-6 lg:-left-8 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-surface border-2 border-sky-400 text-[10px] font-bold text-sky-300 shadow-md shadow-sky-500/20">
                {item.step}
              </div>

              <div className="rounded-xl border border-edge/80 bg-surface/60 p-3.5 transition-all hover:border-slate-600 hover:bg-surface/90 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{item.title}</span>
                    <span className="badge text-[10px] font-mono bg-slate-800 text-slate-300 border-edge">
                      {item.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-sky-400">{item.time} UTC</span>
                    <span className="text-slate-600">·</span>
                    <span className="text-xs text-slate-400">{item.actor}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed pt-0.5">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 9: Persistent Navigation Footer & Action Banner (Requirement 9) ── */}
      <div className="rounded-2xl border border-sky-500/30 bg-gradient-to-r from-sky-950/40 via-surface to-purple-950/20 p-5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-base font-bold text-white flex items-center gap-2">
            <span>📋</span> Synchronize with Response Plan
          </h4>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            This reallocation is active in <strong>Plan {currentEvent.plan_id}</strong>. Review resource assignments, ETAs, and all other tactical response operations.
          </p>
        </div>

        <button
          onClick={handleViewPlan}
          className="flex-shrink-0 flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold px-6 py-2.5 text-sm shadow-lg shadow-sky-900/30 transition-all"
        >
          <span>View Response Plan {currentEvent.plan_id}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </button>
      </div>
    </div>
  )
}
