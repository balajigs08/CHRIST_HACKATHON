import { useState } from 'react'
import Header               from '../components/Header.jsx'
import Sidebar              from '../components/Sidebar.jsx'
import KPICards             from '../components/KPICards.jsx'
import ActiveIncidentsPanel from '../components/ActiveIncidentsPanel.jsx'
import ResourceStatusPanel  from '../components/ResourceStatusPanel.jsx'
import ResponsePlanPanel    from '../components/ResponsePlanPanel.jsx'
import AlertsPanel          from '../components/AlertsPanel.jsx'
import RecentEventsPanel    from '../components/RecentEventsPanel.jsx'
import LiveMapPlaceholder   from '../components/LiveMapPlaceholder.jsx'
import SystemStatusPanel    from '../components/SystemStatusPanel.jsx'
import IncidentsPage        from './IncidentsPage.jsx'
import ResourcesPage        from './ResourcesPage.jsx'
import LiveMapPage          from './LiveMapPage.jsx'
import ResponsePlansPage   from './ResponsePlansPage.jsx'
import EventsPage          from './EventsPage.jsx'
import ReallocationPage    from './ReallocationPage.jsx'
import AlertsPage          from './AlertsPage.jsx'
import SimulationPage      from './SimulationPage.jsx'
import { useRealtime }     from '../hooks/useRealtime.js'
import RealtimeEventToast  from '../components/RealtimeEventToast.jsx'
import { MOCK_SIM_TIME, MOCK_APPROVALS, MOCK_SUMMARY, MOCK_INCIDENTS, MOCK_PLAN_HISTORY } from '../data/mockData.js'
import { fmtTime, pretty, timeSince } from '../types/constants.js'

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const realtime = useRealtime()

  const pendingApprovals = realtime.approvals.filter(a => a.status === 'pending').length
  const criticalCount    = realtime.incidents.filter(i => i.severity === 'critical' && i.status !== 'resolved').length

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* ── Live Toast Notification (Phase 11 Requirement 5) ── */}
      <RealtimeEventToast
        notification={realtime.latestNotification}
        onDismiss={realtime.dismissNotification}
      />

      {/* ── Header with Real-time Status (Requirement 1 & 2) ── */}
      <Header
        simTime={MOCK_SIM_TIME}
        connected={realtime.connectionStatus === 'connected'}
        backendUp={realtime.backendUp}
        pendingApprovals={pendingApprovals}
        realtimeStatus={realtime.connectionStatus}
        onRealtimeStatusChange={realtime.setConnectionStatus}
        lastUpdateTime={realtime.lastUpdateTime}
        onTriggerEvent={realtime.triggerNextMockEvent}
        autoStreamActive={realtime.autoStreamActive}
        onToggleAutoStream={realtime.toggleAutoStream}
      />

      {/* ── Body: Sidebar + Content ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          pendingApprovals={pendingApprovals}
          criticalCount={criticalCount}
        />

        {/* Main content */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          {/* Tab title bar */}
          <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white px-5 py-2.5">
            <h2 className="text-sm font-bold text-slate-700 capitalize">{TAB_TITLES[activeTab] || activeTab}</h2>
            <span className="text-slate-300">·</span>
            <span className="mono text-[11px] text-slate-400">mock data · real-time enabled</span>
            {activeTab === 'dashboard' && pendingApprovals > 0 && (
              <div className="ml-auto flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600 animate-flash">
                ⚠ {pendingApprovals} approval{pendingApprovals > 1 ? 's' : ''} required
              </div>
            )}
          </div>

          <div className="px-4 py-4 space-y-4 max-w-[1600px] mx-auto">
            {/* ── DASHBOARD tab ── */}
            {activeTab === 'dashboard' && <DashboardHome realtime={realtime} />}

            {/* ── INCIDENTS tab ── */}
            {activeTab === 'incidents' && <IncidentsPage />}

            {/* ── RESOURCES tab ── */}
            {activeTab === 'resources' && <ResourcesPage />}

            {/* ── MAP tab ── */}
            {activeTab === 'map' && <LiveMapPage />}

            {/* ── PLAN tab ── */}
            {activeTab === 'plan' && <ResponsePlansPage onNavigate={setActiveTab} />}

            {/* ── REALLOCATION tab ── */}
            {activeTab === 'reallocation' && <ReallocationPage onNavigate={setActiveTab} />}

            {/* ── EVENTS tab ── */}
            {activeTab === 'events' && <EventsPage />}

            {/* ── ALERTS tab ── */}
            {activeTab === 'alerts' && <AlertsPage onNavigate={setActiveTab} />}

            {/* ── SIMULATION tab ── */}
            {activeTab === 'simulation' && <SimulationPage onNavigate={setActiveTab} />}
          </div>
        </main>
      </div>
    </div>
  )
}

const TAB_TITLES = {
  dashboard:    'Command Dashboard',
  incidents:    'Incident Management',
  resources:    'Resource Fleet',
  map:          'Live Tactical Map',
  plan:         'Response Plans',
  reallocation: 'Reallocation Explanation',
  events:       'Event & Audit Log',
  alerts:       'Alerts & Approvals',
  simulation:   'Simulation Controls',
}

/* ── Main Dashboard Home layout (Phase 11 Real-Time Integrated) ── */
function DashboardHome({ realtime }) {
  return (
    <div className="space-y-4">
      {/* KPI row */}
      <KPICards
        summary={realtime?.kpi}
        incidents={realtime?.incidents}
        resources={realtime?.resources}
        approvals={realtime?.approvals}
      />

      {/* Alerts (always on top when present) */}
      <AlertsPanel
        approvals={realtime?.approvals}
        incidents={realtime?.incidents}
      />

      {/* Map + Incidents (2-col on large) */}
      <div className="grid gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <LiveMapPlaceholder incidents={realtime?.incidents} resources={realtime?.resources} />
        </div>
        <div className="xl:col-span-2">
          <ActiveIncidentsPanel incidents={realtime?.incidents} />
        </div>
      </div>

      {/* Resource Status + Response Plan */}
      <div className="grid gap-4 xl:grid-cols-2">
        <ResourceStatusPanel resources={realtime?.resources} />
        <ResponsePlanPanel plan={realtime?.plan} />
      </div>

      {/* Events + System Status */}
      <div className="grid gap-4 xl:grid-cols-2">
        <RecentEventsPanel maxItems={8} events={realtime?.events} />
        <SystemStatusPanel />
      </div>
    </div>
  )
}

/* ── Plan History inline component ── */
function PlanHistoryPanel() {
  return (
    <div className="panel">
      <div className="panel-title">
        <span className="text-purple-600">🔄</span>
        <span>Plan Change History</span>
      </div>
      <div className="divide-y divide-slate-200">
        {MOCK_PLAN_HISTORY.map(h => (
          <div key={h.plan_id} className="px-4 py-3">
            <div className="flex items-baseline gap-2 flex-wrap mb-1.5">
              <span className="mono text-xs font-bold text-slate-800">{h.plan_id}</span>
              <span className="text-slate-500 text-[11px]">{timeSince(h.created_at)}</span>
              <span className="text-[11px] text-amber-800 font-semibold ml-auto italic">{h.trigger}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(h.changes || []).map((c, i) => (
                <span key={i} className="text-[11px] font-medium rounded-md border px-2 py-0.5"
                  style={
                    c.type === 'added'   ? { color:'#15803d', borderColor:'#bbf7d0', background:'#f0fdf4' } :
                    c.type === 'removed' ? { color:'#b91c1c', borderColor:'#fecaca', background:'#fef2f2' } :
                    { color:'#b45309', borderColor:'#fde68a', background:'#fffbeb' }
                  }
                >
                  {c.type === 'added' ? '+' : c.type === 'removed' ? '−' : '~'} {c.text}
                </span>
              ))}
            </div>
            <p className="text-xs text-slate-600 italic border-l-2 border-purple-400 pl-2 bg-purple-50/30 py-1 rounded-r">{h.reason}</p>
          </div>
        ))}
      </div>
    </div>
  )
}


