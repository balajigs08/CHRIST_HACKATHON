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
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl border px-5 py-3.5 shadow-2xl bg-white animate-fade-in ${
            toast.type === 'success'
              ? 'border-emerald-200 text-emerald-800'
              : 'border-sky-200 text-sky-800'
          }`}
        >
          <span className="text-xl">{toast.type === 'success' ? '✅' : '⚡'}</span>
          <span className="text-sm font-semibold text-slate-900">{toast.message}</span>
        </div>
      )}

      {/* ── Top Header ── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b border-slate-200 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="badge border border-sky-200 bg-sky-50 text-sky-800 font-mono text-xs font-bold">
              🎮 TACTICAL SIMULATION ENGINE
            </span>
            <span className="text-xs text-slate-500 font-mono">{scenario.id}</span>
            <span className="text-slate-300">·</span>
            <span className="text-xs text-slate-500">Deterministic Scenario Mode</span>
          </div>
          <h1 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span>Simulation Controls &amp; Scenario Timeline</span>
          </h1>
          <p className="text-xs lg:text-sm text-slate-500 mt-1 max-w-3xl">
            {scenario.description}
          </p>
        </div>

        {/* Current Simulation Status Badge */}
        <div className="flex items-center gap-2.5">
          {simStatus === 'running' && (
            <span className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span>SIMULATION RUNNING</span>
            </span>
          )}
          {simStatus === 'paused' && (
            <span className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-xs">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span>SIMULATION PAUSED</span>
            </span>
          )}
          {simStatus === 'completed' && (
            <span className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 shadow-xs">
              <span>✓ SCENARIO COMPLETED</span>
            </span>
          )}
          {simStatus === 'reset' && (
            <span className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
              <span>READY (RESET)</span>
            </span>
          )}
        </div>
      </div>

      {/* ── Section 1: Simulation Controls Bar ── */}
      <div className="panel p-4 lg:p-5 border-l-4 border-l-sky-500 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          {/* Controls Button Group */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Start Simulation */}
            {simStatus !== 'running' && simStatus !== 'paused' ? (
              <button
                onClick={handleStart}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 text-xs lg:text-sm shadow-sm transition-all"
              >
                <span>▶ Start Simulation</span>
              </button>
            ) : null}

            {/* Pause */}
            {simStatus === 'running' ? (
              <button
                onClick={handlePause}
                className="flex items-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 py-2.5 text-xs lg:text-sm shadow-sm transition-all"
              >
                <span>⏸ Pause</span>
              </button>
            ) : null}

            {/* Resume */}
            {simStatus === 'paused' ? (
              <button
                onClick={handleResume}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 text-xs lg:text-sm shadow-sm transition-all"
              >
                <span>▶ Resume</span>
              </button>
            ) : null}

            {/* Next Event */}
            <button
              onClick={handleNextEvent}
              disabled={simStatus === 'completed'}
              className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold px-4 py-2.5 text-xs lg:text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>Next Event ⏩</span>
            </button>

            {/* Reset */}
            <button
              onClick={handleReset}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold px-4 py-2.5 text-xs lg:text-sm transition-all"
            >
              <span>↺ Reset</span>
            </button>
          </div>

          {/* Speed Selector */}
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-600">Playback Speed:</span>
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
                    ? 'bg-sky-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {spd.label.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Current Simulation Time & Event Counter */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Current Event Counter
              </div>
              <div className="text-base font-black text-slate-900 font-mono mt-0.5">
                Event {currentStepIndex + 1} of {totalSteps}
              </div>
            </div>
            <span className="badge text-xs font-mono font-bold bg-sky-50 text-sky-800 border-sky-200">
              {progressPercent}% Complete
            </span>
          </div>

          <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-sky-700">
                Simulation Clock Time
              </div>
              <div className="text-base font-black text-sky-900 font-mono mt-0.5">
                {currentEvent.time} UTC
              </div>
            </div>
            <span className="text-xs font-mono text-slate-500 font-bold">
              T+{currentStepIndex * 6}m
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Active Tactical Phase
              </div>
              <div className="text-sm font-bold text-slate-900 mt-0.5 truncate max-w-[200px]">
                {currentEvent.title}
              </div>
            </div>
            <span className="text-lg">{currentEvent.icon}</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between text-[11px] font-mono text-slate-500">
            <span>T=0: Start Scenario</span>
            <span className="font-semibold text-slate-800">Current: {currentEvent.title}</span>
            <span>T=45m: Complete</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-600 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Section 2: "Scenario Overview" Metrics ── */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
          <span>📊</span> Scenario Overview (Live State at Event #{currentStepIndex + 1})
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {/* Total Incidents */}
          <div className="panel p-3.5">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Total Incidents</span>
              <span className="text-base">📍</span>
            </div>
            <div className="mt-1 text-2xl font-black text-slate-900">
              {currentSystemState.total_incidents}
            </div>
            <div className="mt-0.5 text-[10px] text-slate-500 font-mono">
              In city sector queue
            </div>
          </div>

          {/* Critical Incidents */}
          <div className="panel p-3.5 border-red-200 bg-red-50/40">
            <div className="flex items-center justify-between text-red-700 text-xs font-medium">
              <span>Critical Incidents</span>
              <span className="text-base">🔥</span>
            </div>
            <div className="mt-1 text-2xl font-black text-red-700">
              {currentSystemState.critical_incidents}
            </div>
            <div className="mt-0.5 text-[10px] text-red-700/80 font-mono">
              Urgency &gt;= 9 / Priority 1
            </div>
          </div>

          {/* Available Resources */}
          <div className="panel p-3.5 border-emerald-200 bg-emerald-50/40">
            <div className="flex items-center justify-between text-emerald-700 text-xs font-medium">
              <span>Available Units</span>
              <span className="text-base">🚒</span>
            </div>
            <div className="mt-1 text-2xl font-black text-emerald-700">
              {currentSystemState.available_resources}
            </div>
            <div className="mt-0.5 text-[10px] text-emerald-700/80 font-mono">
              Standby &amp; ready
            </div>
          </div>

          {/* Assigned Resources */}
          <div className="panel p-3.5 border-sky-200 bg-sky-50/40">
            <div className="flex items-center justify-between text-sky-700 text-xs font-medium">
              <span>Assigned Units</span>
              <span className="text-base">🚚</span>
            </div>
            <div className="mt-1 text-2xl font-black text-sky-700">
              {currentSystemState.assigned_resources}
            </div>
            <div className="mt-0.5 text-[10px] text-sky-700/80 font-mono">
              En route / on scene
            </div>
          </div>

          {/* Pending Decisions */}
          <div className={`panel p-3.5 ${currentSystemState.pending_decisions > 0 ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200'}`}>
            <div className="flex items-center justify-between text-xs font-medium">
              <span className={currentSystemState.pending_decisions > 0 ? 'text-amber-700' : 'text-slate-500'}>
                Pending Decisions
              </span>
              <span className="text-base">{currentSystemState.pending_decisions > 0 ? '⚠️' : '✓'}</span>
            </div>
            <div className={`mt-1 text-2xl font-black ${currentSystemState.pending_decisions > 0 ? 'text-amber-700' : 'text-slate-500'}`}>
              {currentSystemState.pending_decisions}
            </div>
            <div className="mt-0.5 text-[10px] text-slate-500 font-mono">
              Supervisor review
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 3: "Current System State" Panel ── */}
      <div className="panel p-4 lg:p-5 space-y-4 border-slate-200 bg-slate-50/60">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <span>🖥️</span> Current System State (Simulated Telemetry Snapshot)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live operational metrics reflecting Event #{currentStepIndex + 1}: {currentEvent.title}
            </p>
          </div>
          <span className="badge font-mono text-xs bg-white text-sky-800 border-slate-200 font-bold">
            Clock: {currentEvent.time} UTC
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* 1. Active Incidents */}
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2 shadow-xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <span>📍</span> Active Incidents ({currentSystemState.active_incidents.length})
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {currentSystemState.active_incidents.map((incId) => (
                <span
                  key={incId}
                  className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-sky-800 border border-slate-200"
                >
                  {incId}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 pt-1">
              {currentSystemState.status_note}
            </p>
          </div>

          {/* 2. Resource Status */}
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2 shadow-xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <span>🚒</span> Resource Fleet Status
            </div>
            <div className="text-xs font-bold text-emerald-700 pt-1">
              {currentSystemState.resource_status}
            </div>
            <p className="text-[11px] text-slate-500">
              Fleet distribution updated according to triage priority.
            </p>
          </div>

          {/* 3. Current Response Plan */}
          <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-3.5 space-y-2 shadow-xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-purple-700 flex items-center gap-1.5">
              <span>📋</span> Current Response Plan
            </div>
            <div className="text-xs font-bold text-slate-900 pt-1 font-mono">
              {currentSystemState.active_plan_id}
            </div>
            <p className="text-[11px] text-purple-700">
              Optimization solver active vectors.
            </p>
          </div>

          {/* 4. Alerts Requiring Attention */}
          <div className={`rounded-xl border p-3.5 space-y-2 shadow-xs ${currentSystemState.alerts_requiring_attention > 0 ? 'border-red-200 bg-red-50/50' : 'border-slate-200 bg-white'}`}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-red-700 flex items-center gap-1.5">
              <span>🚨</span> Alerts Requiring Attention
            </div>
            <div className="text-xs font-bold text-red-700 pt-1">
              {currentSystemState.alerts_requiring_attention > 0
                ? `${currentSystemState.alerts_requiring_attention} Alert(s) Need Signoff`
                : 'Zero Critical Deficits'}
            </div>
            <p className="text-[11px] text-slate-500">
              {currentSystemState.alerts_requiring_attention > 0
                ? 'Check Alerts page for pending tickets.'
                : 'All constraints within nominal safety bounds.'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Section 4: "Scenario Events" List & Visual Timeline ── */}
      <div className="panel p-4 lg:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>📜</span> Scenario Events &amp; Chronological Progression
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Interactive timeline of all 8 predetermined disaster milestones. Click any event to inspect state.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">
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
                className={`cursor-pointer rounded-2xl border p-4 transition-all space-y-2 relative overflow-hidden shadow-xs ${
                  isCurrent
                    ? 'border-sky-400 bg-sky-50/60 shadow-md ring-1 ring-sky-300'
                    : isPassed
                    ? 'border-slate-200 bg-slate-50/60 opacity-80 hover:opacity-100 hover:border-slate-300'
                    : 'border-slate-200 bg-white opacity-60 hover:opacity-100'
                }`}
              >
                {/* Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-xl text-xs font-mono font-black ${
                        isCurrent
                          ? 'bg-sky-600 text-white shadow-xs'
                          : isPassed
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {evt.step}
                    </span>

                    <span className="text-base">{evt.icon}</span>

                    <h4 className="text-sm font-bold text-slate-900">
                      {evt.title}
                    </h4>

                    <span
                      className={`badge text-[10px] font-bold ${
                        evt.severity === 'critical'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : evt.severity === 'high'
                          ? 'bg-orange-50 text-orange-700 border-orange-200'
                          : 'bg-sky-50 text-sky-800 border-sky-200'
                      }`}
                    >
                      {evt.severity.toUpperCase()}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-sky-700 font-bold">
                      {evt.time} UTC
                    </span>

                    {isCurrent && (
                      <span className="badge text-[10px] font-bold bg-sky-100 text-sky-800 border-sky-300">
                        CURRENT ACTIVE
                      </span>
                    )}
                    {isPassed && (
                      <span className="badge text-[10px] font-bold bg-emerald-50 text-emerald-700 border-emerald-200">
                        ✓ EXECUTED
                      </span>
                    )}
                    {isPending && (
                      <span className="badge text-[10px] font-mono bg-slate-100 text-slate-500 border-slate-200">
                        QUEUED
                      </span>
                    )}
                  </div>
                </div>

                {/* Event Description */}
                <p className="text-xs text-slate-700 leading-relaxed pl-9 font-medium">
                  {evt.description}
                </p>

                {/* Associated Meta */}
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pl-9 pt-1 font-mono">
                  <span>Target: <strong className="text-slate-800">{evt.incident_id}</strong></span>
                  <span className="text-slate-300">·</span>
                  <span>Type: <strong className="text-slate-800">{prettyCap(evt.event_type)}</strong></span>
                  <span className="text-slate-300">·</span>
                  <span>Plan: <strong className="text-slate-800">{evt.state.active_plan_id}</strong></span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
