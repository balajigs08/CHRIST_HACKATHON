import { useState, useEffect, useMemo, useRef } from 'react'
import { MOCK_SIMULATION_SCENARIO, MOCK_INCIDENTS, MOCK_RESOURCES } from '../data/mockData.js'
import { fmtTime, timeSince, pretty, prettyCap } from '../types/constants.js'

export default function SimulationPage({ onNavigate }) {
  const scenario = MOCK_SIMULATION_SCENARIO
  const totalSteps = scenario.events.length

  // Simulation playback state: 'reset' | 'running' | 'paused' | 'completed'
  const [simStatus, setSimStatus] = useState('reset')
  const [currentStepIndex, setCurrentStepIndex] = useState(0) // 0 means ready (step 1 not yet completed) or step index (0 to 7)
  const [playbackSpeed, setPlaybackSpeed] = useState(2500) // ms per event step: 3500ms (1x), 2000ms (2x), 1000ms (4x)
  const [toast, setToast] = useState(null)

  const timerRef = useRef(null)

  const showToast = (message, type = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Active event object
  const currentEvent = scenario.events[currentStepIndex] || scenario.events[0]
  const currentSystemState = currentEvent.state

  // Auto-play timer when running
  useEffect(() => {
    if (simStatus === 'running') {
      timerRef.current = setInterval(() => {
        setCurrentStepIndex((prev) => {
          if (prev >= totalSteps - 1) {
            setSimStatus('completed')
            showToast('✓ Simulation scenario completed! All 8 tactical events executed.', 'success')
            return prev
          }
          const next = prev + 1
          const nextEvt = scenario.events[next]
          showToast(`⚡ Step ${next + 1}/${totalSteps}: "${nextEvt.title}"`, 'info')
          return next
        })
      }, playbackSpeed)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [simStatus, playbackSpeed, totalSteps])

  // ── Controls Handlers ──
  const handleStart = () => {
    setSimStatus('running')
    if (currentStepIndex === totalSteps - 1) {
      setCurrentStepIndex(0)
    }
    showToast('▶ Simulation started: automated emergency clock running.', 'info')
  }

  const handlePause = () => {
    setSimStatus('paused')
    showToast('⏸ Simulation paused by commander.', 'info')
  }

  const handleResume = () => {
    setSimStatus('running')
    showToast('▶ Simulation resumed.', 'info')
  }

  const handleReset = () => {
    setSimStatus('reset')
    setCurrentStepIndex(0)
    showToast('↺ Simulation reset to initial state T=0 (13:00 UTC).', 'info')
  }

  const handleNextEvent = () => {
    if (currentStepIndex < totalSteps - 1) {
      const next = currentStepIndex + 1
      setCurrentStepIndex(next)
      const nextEvt = scenario.events[next]
      if (next === totalSteps - 1) {
        setSimStatus('completed')
        showToast(`✓ Step ${next + 1}/${totalSteps}: "${nextEvt.title}" (Final)`, 'success')
      } else {
        showToast(`⏩ Stepped to Event ${next + 1}: "${nextEvt.title}"`, 'info')
      }
    } else {
      showToast('Simulation is already at the final event. Click Reset to restart.', 'info')
    }
  }

  const handleJumpToStep = (index) => {
    setCurrentStepIndex(index)
    if (index === totalSteps - 1) {
      setSimStatus('completed')
    } else if (simStatus === 'completed') {
      setSimStatus('paused')
    }
    showToast(`Jumped to Event ${index + 1}: "${scenario.events[index].title}"`, 'info')
  }

  // Progress percentage
  const progressPercent = Math.round(((currentStepIndex + 1) / totalSteps) * 100)

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* ── Toast Feedback ── */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl border px-5 py-3.5 shadow-2xl backdrop-blur-xl animate-fade-in ${
            toast.type === 'success'
              ? 'border-emerald-500/40 bg-slate-950/90 text-emerald-300'
              : 'border-sky-500/40 bg-slate-950/90 text-sky-300'
          }`}
        >
          <span className="text-xl">{toast.type === 'success' ? '✅' : '⚡'}</span>
          <span className="text-sm font-semibold text-white">{toast.message}</span>
        </div>
      )}

      {/* ── Top Header ── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b border-edge/60 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="badge border border-sky-500/40 bg-sky-500/10 text-sky-300 font-mono text-xs">
              🎮 TACTICAL SIMULATION ENGINE
            </span>
            <span className="text-xs text-slate-500 font-mono">{scenario.id}</span>
            <span className="text-slate-600">·</span>
            <span className="text-xs text-slate-400">Deterministic Scenario Mode</span>
          </div>
          <h1 className="text-xl lg:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <span>Simulation Controls &amp; Scenario Timeline</span>
          </h1>
          <p className="text-xs lg:text-sm text-slate-400 mt-1 max-w-3xl">
            {scenario.description}
          </p>
        </div>

        {/* Current Simulation Status Badge (Requirement 3) */}
        <div className="flex items-center gap-2.5">
          {simStatus === 'running' && (
            <span className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-lg shadow-emerald-950/20">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span>SIMULATION RUNNING</span>
            </span>
          )}
          {simStatus === 'paused' && (
            <span className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-lg shadow-amber-950/20">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <span>SIMULATION PAUSED</span>
            </span>
          )}
          {simStatus === 'completed' && (
            <span className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-lg shadow-purple-950/20">
              <span>✓ SCENARIO COMPLETED</span>
            </span>
          )}
          {simStatus === 'reset' && (
            <span className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold bg-slate-800 text-slate-300 border border-edge">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-500" />
              <span>READY (RESET)</span>
            </span>
          )}
        </div>
      </div>

      {/* ── Section 1: Simulation Controls Bar (Requirement 2 & 5) ── */}
      <div className="panel p-4 lg:p-5 border-l-4 border-l-sky-500 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-edge/60 pb-4">
          {/* Controls Button Group */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Start Simulation */}
            {simStatus !== 'running' && simStatus !== 'paused' ? (
              <button
                onClick={handleStart}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold px-5 py-2.5 text-xs lg:text-sm shadow-lg shadow-emerald-950/30 transition-all"
              >
                <span>▶ Start Simulation</span>
              </button>
            ) : null}

            {/* Pause */}
            {simStatus === 'running' ? (
              <button
                onClick={handlePause}
                className="flex items-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold px-5 py-2.5 text-xs lg:text-sm shadow-lg shadow-amber-950/30 transition-all"
              >
                <span>⏸ Pause</span>
              </button>
            ) : null}

            {/* Resume */}
            {simStatus === 'paused' ? (
              <button
                onClick={handleResume}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold px-5 py-2.5 text-xs lg:text-sm shadow-lg shadow-emerald-950/30 transition-all"
              >
                <span>▶ Resume</span>
              </button>
            ) : null}

            {/* Next Event */}
            <button
              onClick={handleNextEvent}
              disabled={simStatus === 'completed'}
              className="flex items-center gap-2 rounded-xl border border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 font-bold px-4 py-2.5 text-xs lg:text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>Next Event ⏩</span>
            </button>

            {/* Reset */}
            <button
              onClick={handleReset}
              className="flex items-center gap-2 rounded-xl border border-edge bg-surface/60 hover:bg-surface text-slate-300 font-semibold px-4 py-2.5 text-xs lg:text-sm transition-all"
            >
              <span>↺ Reset</span>
            </button>
          </div>

          {/* Speed Selector */}
          <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-edge">
            <span className="text-[11px] font-semibold text-slate-400">Playback Speed:</span>
            {[
              { label: '1x (Slow)', ms: 3500 },
              { label: '2x (Normal)', ms: 2000 },
              { label: '4x (Fast)', ms: 1000 },
            ].map((spd) => (
              <button
                key={spd.ms}
                onClick={() => setPlaybackSpeed(spd.ms)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
                  playbackSpeed === spd.ms
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {spd.label.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Current Simulation Time & Event Counter (Requirement 5) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="rounded-xl border border-edge bg-surface/50 p-3 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Current Event Counter
              </div>
              <div className="text-base font-black text-white font-mono mt-0.5">
                Event {currentStepIndex + 1} of {totalSteps}
              </div>
            </div>
            <span className="badge text-xs font-mono font-bold bg-sky-500/15 text-sky-300 border-sky-500/30">
              {progressPercent}% Complete
            </span>
          </div>

          <div className="rounded-xl border border-sky-500/30 bg-sky-500/05 p-3 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                Simulation Clock Time
              </div>
              <div className="text-base font-black text-sky-300 font-mono mt-0.5">
                {currentEvent.time} UTC
              </div>
            </div>
            <span className="text-xs font-mono text-slate-400">
              T+{currentStepIndex * 6}m
            </span>
          </div>

          <div className="rounded-xl border border-edge bg-surface/50 p-3 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Active Tactical Phase
              </div>
              <div className="text-sm font-bold text-white mt-0.5 truncate max-w-[200px]">
                {currentEvent.title}
              </div>
            </div>
            <span className="text-lg">{currentEvent.icon}</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between text-[11px] font-mono text-slate-400">
            <span>T=0: Start Scenario</span>
            <span>Current: {currentEvent.title}</span>
            <span>T=45m: Complete</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-900 border border-edge overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-500 via-blue-500 to-purple-500 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Section 2: "Scenario Overview" Metrics (Requirement 6) ── */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <span>📊</span> Scenario Overview (Live State at Event #{currentStepIndex + 1})
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {/* Total Incidents */}
          <div className="panel p-3.5">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Total Incidents</span>
              <span className="text-base">📍</span>
            </div>
            <div className="mt-1 text-2xl font-black text-white">
              {currentSystemState.total_incidents}
            </div>
            <div className="mt-0.5 text-[10px] text-slate-400 font-mono">
              In city sector queue
            </div>
          </div>

          {/* Critical Incidents */}
          <div className="panel p-3.5 border-red-500/30 bg-red-500/05">
            <div className="flex items-center justify-between text-red-400 text-xs font-medium">
              <span>Critical Incidents</span>
              <span className="text-base">🔥</span>
            </div>
            <div className="mt-1 text-2xl font-black text-red-300">
              {currentSystemState.critical_incidents}
            </div>
            <div className="mt-0.5 text-[10px] text-red-300/80 font-mono">
              Urgency &gt;= 9 / Priority 1
            </div>
          </div>

          {/* Available Resources */}
          <div className="panel p-3.5 border-emerald-500/30 bg-emerald-500/05">
            <div className="flex items-center justify-between text-emerald-400 text-xs font-medium">
              <span>Available Units</span>
              <span className="text-base">🚒</span>
            </div>
            <div className="mt-1 text-2xl font-black text-emerald-300">
              {currentSystemState.available_resources}
            </div>
            <div className="mt-0.5 text-[10px] text-emerald-300/80 font-mono">
              Standby &amp; ready
            </div>
          </div>

          {/* Assigned Resources */}
          <div className="panel p-3.5 border-sky-500/30 bg-sky-500/05">
            <div className="flex items-center justify-between text-sky-400 text-xs font-medium">
              <span>Assigned Units</span>
              <span className="text-base">🚚</span>
            </div>
            <div className="mt-1 text-2xl font-black text-sky-300">
              {currentSystemState.assigned_resources}
            </div>
            <div className="mt-0.5 text-[10px] text-sky-300/80 font-mono">
              En route / on scene
            </div>
          </div>

          {/* Pending Decisions */}
          <div className={`panel p-3.5 ${currentSystemState.pending_decisions > 0 ? 'border-amber-500/40 bg-amber-500/08' : 'border-slate-800'}`}>
            <div className="flex items-center justify-between text-xs font-medium">
              <span className={currentSystemState.pending_decisions > 0 ? 'text-amber-400' : 'text-slate-500'}>
                Pending Decisions
              </span>
              <span className="text-base">{currentSystemState.pending_decisions > 0 ? '⚠️' : '✓'}</span>
            </div>
            <div className={`mt-1 text-2xl font-black ${currentSystemState.pending_decisions > 0 ? 'text-amber-300' : 'text-slate-400'}`}>
              {currentSystemState.pending_decisions}
            </div>
            <div className="mt-0.5 text-[10px] text-slate-400 font-mono">
              Supervisor review
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 3: "Current System State" Panel (Requirement 8) ── */}
      <div className="panel p-4 lg:p-5 space-y-4 border-slate-700/80 bg-gradient-to-r from-surface/90 to-slate-900/50">
        <div className="flex items-center justify-between border-b border-edge/60 pb-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <span>🖥️</span> Current System State (Simulated Telemetry Snapshot)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live operational metrics reflecting Event #{currentStepIndex + 1}: {currentEvent.title}
            </p>
          </div>
          <span className="badge font-mono text-xs bg-slate-800 text-sky-300 border-edge">
            Clock: {currentEvent.time} UTC
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* 1. Active Incidents */}
          <div className="rounded-xl border border-edge bg-surface/60 p-3.5 space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <span>📍</span> Active Incidents ({currentSystemState.active_incidents.length})
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {currentSystemState.active_incidents.map((incId) => (
                <span
                  key={incId}
                  className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-sky-300 border border-edge"
                >
                  {incId}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 pt-1">
              {currentSystemState.status_note}
            </p>
          </div>

          {/* 2. Resource Status */}
          <div className="rounded-xl border border-edge bg-surface/60 p-3.5 space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <span>🚒</span> Resource Fleet Status
            </div>
            <div className="text-xs font-bold text-emerald-300 pt-1">
              {currentSystemState.resource_status}
            </div>
            <p className="text-[11px] text-slate-400">
              Fleet distribution updated according to triage priority.
            </p>
          </div>

          {/* 3. Current Response Plan */}
          <div className="rounded-xl border border-purple-500/30 bg-purple-500/05 p-3.5 space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
              <span>📋</span> Current Response Plan
            </div>
            <div className="text-xs font-bold text-white pt-1 font-mono">
              {currentSystemState.active_plan_id}
            </div>
            <p className="text-[11px] text-slate-300">
              Optimization solver active vectors.
            </p>
          </div>

          {/* 4. Alerts Requiring Attention */}
          <div className={`rounded-xl border p-3.5 space-y-2 ${currentSystemState.alerts_requiring_attention > 0 ? 'border-red-500/40 bg-red-500/05' : 'border-edge bg-surface/60'}`}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
              <span>🚨</span> Alerts Requiring Attention
            </div>
            <div className="text-xs font-bold text-red-300 pt-1">
              {currentSystemState.alerts_requiring_attention > 0
                ? `${currentSystemState.alerts_requiring_attention} Alert(s) Need Signoff`
                : 'Zero Critical Deficits'}
            </div>
            <p className="text-[11px] text-slate-400">
              {currentSystemState.alerts_requiring_attention > 0
                ? 'Check Alerts page for pending tickets.'
                : 'All constraints within nominal safety bounds.'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Section 4: "Scenario Events" List & Visual Timeline (Requirements 4 & 7) ── */}
      <div className="panel p-4 lg:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-edge/60 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>📜</span> Scenario Events &amp; Chronological Progression
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Interactive timeline of all 8 predetermined disaster milestones. Click any event to inspect state.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Click step to jump
          </span>
        </div>

        {/* Timeline Events List */}
        <div className="space-y-3">
          {scenario.events.map((evt, idx) => {
            const isCurrent = currentStepIndex === idx
            const isPassed = currentStepIndex > idx
            const isPending = currentStepIndex < idx

            return (
              <div
                key={evt.step}
                onClick={() => handleJumpToStep(idx)}
                className={`cursor-pointer rounded-2xl border p-4 transition-all space-y-2 relative overflow-hidden ${
                  isCurrent
                    ? 'border-sky-500/50 bg-slate-900/90 shadow-lg shadow-sky-500/10 ring-1 ring-sky-500/30'
                    : isPassed
                    ? 'border-edge bg-surface/50 opacity-80 hover:opacity-100 hover:border-slate-600'
                    : 'border-edge/60 bg-surface/30 opacity-50 hover:opacity-80'
                }`}
              >
                {/* Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-xl text-xs font-mono font-black ${
                        isCurrent
                          ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30 animate-pulse'
                          : isPassed
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border border-edge'
                      }`}
                    >
                      {evt.step}
                    </span>

                    <span className="text-base">{evt.icon}</span>

                    <h4 className="text-sm font-bold text-white">
                      {evt.title}
                    </h4>

                    <span
                      className={`badge text-[10px] font-bold ${
                        evt.severity === 'critical'
                          ? 'bg-red-500/20 text-red-300 border-red-500/40'
                          : evt.severity === 'high'
                          ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                          : 'bg-slate-800 text-sky-300 border-edge'
                      }`}
                    >
                      {evt.severity.toUpperCase()}
                    </span>
                  </div>

                  {/* Status Badge (Requirement 7) */}
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-sky-400 font-bold">
                      {evt.time} UTC
                    </span>

                    {isCurrent && (
                      <span className="badge text-[10px] font-bold bg-sky-500/20 text-sky-300 border-sky-500/40 animate-pulse">
                        CURRENT ACTIVE
                      </span>
                    )}
                    {isPassed && (
                      <span className="badge text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
                        ✓ EXECUTED
                      </span>
                    )}
                    {isPending && (
                      <span className="badge text-[10px] font-mono bg-slate-800 text-slate-500 border-edge">
                        QUEUED
                      </span>
                    )}
                  </div>
                </div>

                {/* Event Description (Requirement 7) */}
                <p className="text-xs text-slate-300 leading-relaxed pl-9">
                  {evt.description}
                </p>

                {/* Associated Meta */}
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pl-9 pt-1 font-mono">
                  <span>Target: <strong className="text-slate-200">{evt.incident_id}</strong></span>
                  <span className="text-slate-600">·</span>
                  <span>Type: <strong className="text-slate-200">{prettyCap(evt.event_type)}</strong></span>
                  <span className="text-slate-600">·</span>
                  <span>Plan: <strong className="text-slate-200">{evt.state.active_plan_id}</strong></span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
