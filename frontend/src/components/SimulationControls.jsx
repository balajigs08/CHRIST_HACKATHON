import { useState } from 'react'
import { api } from '../services/api.js'

const INCIDENT_TYPES = [
  { kind: 'road_accident',      label: 'Road Accident',      icon: '🚗', tone: 'btn-sim' },
  { kind: 'medical_emergency',  label: 'Medical Emergency',  icon: '🏥', tone: 'btn-sim' },
  { kind: 'building_fire',      label: 'Building Fire',      icon: '🔥', tone: 'btn-sim' },
  { kind: 'critical',           label: 'Critical Incident',  icon: '💥', tone: 'btn-danger-soft' },
]

export default function SimulationControls({ run, busy }) {
  const [text, setText] = useState('')
  const [advMin, setAdvMin] = useState(10)
  const [lastAction, setLastAction] = useState(null)

  const act = (label, fn) => {
    setLastAction(label)
    run(fn).finally(() => setTimeout(() => setLastAction(null), 2000))
  }

  const submit = e => {
    e.preventDefault()
    if (text.trim().length < 3) return
    act('Assessing…', () => api.createIncident(text.trim()))
    setText('')
  }

  return (
    <div className="panel">
      {/* Header */}
      <div className="panel-title">
        <span className="text-sky-600">🎮</span>
        <span>Simulation Controls</span>
        {lastAction && (
          <span className="ml-auto mono text-[10px] text-sky-600 normal-case font-bold">
            ⟳ {lastAction}
          </span>
        )}
      </div>

      <div className="space-y-4 px-4 pb-4 pt-3">
        {/* Guided Demo Section */}
        <Section icon="🗺" title="Guided Demo">
          <div className="grid grid-cols-1 gap-2">
            <DemoButton
              label="① Load T=0 Scenario"
              desc="Road accident (High) + Building fire (Critical) + Medical (Medium)"
              icon="▶"
              tone="btn-sim"
              busy={busy}
              onClick={() => act('Loading T=0…', api.demoT0)}
            />
            <DemoButton
              label="② T+10: Critical Collapse + A01 Fails"
              desc="Building collapse (Critical) arrives, ambulance A01 breaks down → triggers replan + approval"
              icon="⏩"
              tone="btn-danger-soft"
              busy={busy}
              onClick={() => act('Running T+10…', api.demoT10)}
            />
          </div>
        </Section>

        <Divider />

        {/* Add Incidents */}
        <Section icon="⚠" title="Add Incident">
          <div className="grid grid-cols-2 gap-2">
            {INCIDENT_TYPES.map(({ kind, label, icon, tone }) => (
              <button
                key={kind}
                disabled={busy}
                onClick={() => act(`Adding ${label}…`, () => api.simIncident(kind))}
                className={`btn ${tone} flex-col items-start gap-0.5 py-2.5 px-3 text-left h-auto`}
              >
                <span className="text-base">{icon}</span>
                <span className="text-[11px] font-semibold">{label}</span>
              </button>
            ))}
          </div>
        </Section>

        <Divider />

        {/* Resource & Time controls */}
        <Section icon="🚑" title="Resource & Time">
          <div className="flex flex-wrap gap-2">
            <button disabled={busy} onClick={() => act('Breaking ambulance…', api.breakAmbulance)}
              className="btn btn-danger-soft flex-1">
              ✗ Break Ambulance
            </button>
            <button disabled={busy} onClick={() => act('Restoring ambulance…', api.restoreAmbulance)}
              className="btn btn-success flex-1">
              ✓ Restore Ambulance
            </button>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button disabled={busy} onClick={() => act('Recalculating…', api.recalc)}
              className="btn bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 flex-1">
              ⟳ Recalculate Plan
            </button>
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2">
              <button className="text-slate-500 hover:text-slate-800 px-1 font-bold" onClick={() => setAdvMin(m => Math.max(5, m-5))}>−</button>
              <span className="mono text-xs text-slate-700 font-bold w-10 text-center">+{advMin}m</span>
              <button className="text-slate-500 hover:text-slate-800 px-1 font-bold" onClick={() => setAdvMin(m => Math.min(60, m+5))}>+</button>
            </div>
            <button disabled={busy} onClick={() => act(`Advancing +${advMin}min…`, () => api.advance(advMin))}
              className="btn btn-warn flex-1">
              ⏱ Advance Time
            </button>
          </div>
        </Section>

        <Divider />

        {/* Free text */}
        <Section icon="✍" title="Assess & Dispatch">
          <form onSubmit={submit} className="space-y-2">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={3}
              placeholder={`Report an emergency in plain text…\ne.g. "Major gas explosion near City Centre, multiple casualties trapped."`}
              className="input resize-none text-sm bg-white"
            />
            <button
              disabled={busy || text.trim().length < 3}
              className="btn btn-primary w-full py-2.5 text-sm"
            >
              ⚡ Assess & Dispatch
            </button>
          </form>
        </Section>

        <Divider />

        {/* Reset */}
        <button
          disabled={busy}
          onClick={() => {
            if (window.confirm('Reset all incidents and resources to demo state?')) {
              act('Resetting…', api.reset)
            }
          }}
          className="btn btn-warn w-full"
        >
          ↺ Reset Scenario
        </button>
      </div>
    </div>
  )
}

function Section({ icon, title, children }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
        <span>{icon}</span>{title}
      </p>
      {children}
    </div>
  )
}

function DemoButton({ label, desc, icon, tone, busy, onClick }) {
  return (
    <button
      disabled={busy}
      onClick={onClick}
      className={`btn ${tone} h-auto flex-col items-start gap-1 px-3 py-3 text-left`}
    >
      <span className="flex items-center gap-2 font-bold text-[12px]">
        <span>{icon}</span>{label}
      </span>
      <span className="text-[10px] opacity-70 font-normal leading-relaxed">{desc}</span>
    </button>
  )
}

function Divider() {
  return <div className="divider" />
}
