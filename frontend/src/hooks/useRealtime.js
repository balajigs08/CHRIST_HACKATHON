/**
 * Custom React Hook: useRealtime (Phase 11)
 *
 * Subscribes to the realtime service and maintains reactive frontend state
 * for all live components: incidents, resources, response plan, alerts,
 * audit events, statistics, and connection lifecycle.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { realtimeService } from '../services/websocket.js'
import { api } from '../services/api.js'
import {
  MOCK_INCIDENTS,
  MOCK_RESOURCES,
  MOCK_PLAN,
  MOCK_APPROVALS,
  MOCK_ALERTS,
  MOCK_EVENTS,
  MOCK_SUMMARY,
} from '../data/mockData.js'

export function useRealtime() {
  const [connectionStatus, setConnectionStatusState] = useState('connected')
  const [backendUp, setBackendUp] = useState(false)
  const [lastUpdateTime, setLastUpdateTime] = useState(new Date().toISOString())
  const [latestNotification, setLatestNotification] = useState(null)
  const [autoStreamActive, setAutoStreamActive] = useState(false)

  // Live state collections (initialized from baseline mock data, updated via backend REST/WS)
  const [incidents, setIncidents] = useState(MOCK_INCIDENTS)
  const [resources, setResources] = useState(MOCK_RESOURCES)
  const [plan, setPlan] = useState(MOCK_PLAN)
  const [approvals, setApprovals] = useState(MOCK_APPROVALS)
  const [alerts, setAlerts] = useState(MOCK_ALERTS)
  const [events, setEvents] = useState(MOCK_EVENTS)

  // Listen to connection status changes
  useEffect(() => {
    const unsub = realtimeService.onStatusChange((newStatus) => {
      setConnectionStatusState(newStatus)
      if (newStatus === 'connected') {
        setBackendUp(true)
      }
    })
    return unsub
  }, [])

  // Initial fetch from backend REST endpoints
  useEffect(() => {
    let active = true

    async function loadBackendData() {
      try {
        const health = await api.health()
        if (!active) return
        if (health?.status === 'ok') {
          setBackendUp(true)
        }

        const [incRes, resRes, plansRes, alertsRes, apprRes, evtRes] = await Promise.allSettled([
          api.incidents.list(),
          api.resources.list(),
          api.plans.list(),
          api.alerts.list(),
          api.approvals.list(),
          api.events.list(),
        ])

        if (!active) return
        if (incRes.status === 'fulfilled' && Array.isArray(incRes.value) && incRes.value.length) {
          setIncidents(incRes.value.map(i => ({ ...i, id: i.incident_id || i.id })))
        }
        if (resRes.status === 'fulfilled' && Array.isArray(resRes.value) && resRes.value.length) {
          setResources(resRes.value.map(r => ({ ...r, id: r.resource_id || r.id })))
        }
        if (plansRes.status === 'fulfilled' && Array.isArray(plansRes.value) && plansRes.value.length) {
          setPlan(plansRes.value[0])
        }
        if (alertsRes.status === 'fulfilled' && Array.isArray(alertsRes.value) && alertsRes.value.length) {
          setAlerts(alertsRes.value.map(a => ({ ...a, id: a.alert_id || a.id })))
        }
        if (apprRes.status === 'fulfilled' && Array.isArray(apprRes.value) && apprRes.value.length) {
          setApprovals(apprRes.value.map(ap => ({ ...ap, id: ap.request_id || ap.id })))
        }
        if (evtRes.status === 'fulfilled' && evtRes.value?.items?.length) {
          setEvents(evtRes.value.items.map(e => ({ ...e, id: e.event_id || e.id })))
        }
      } catch (err) {
        // Fallback to baseline data safely
      }
    }

    loadBackendData()
    realtimeService.connect()

    return () => {
      active = false
    }
  }, [])

  // Auto-dismiss latest notification after 4.5s
  useEffect(() => {
    if (!latestNotification) return
    const timer = setTimeout(() => {
      setLatestNotification(null)
    }, 4500)
    return () => clearTimeout(timer)
  }, [latestNotification])

  // ── Dispatch Incoming Real-time Event to Local State ──
  const handleIncomingEvent = useCallback((event) => {
    const now = new Date().toISOString()
    setLastUpdateTime(now)

    // Trigger floating notification toast (Requirement 5)
    setLatestNotification({
      id: event.id || `notif-${Date.now()}`,
      title: event.title,
      type: event.type,
      severity: event.severity || 'info',
      time: event.timestamp || now,
    })

    // Update state based on event type (Requirements 4 & 6)
    switch (event.type) {
      case 'NEW_INCIDENT': {
        const newInc = event.payload.incident
        if (newInc) {
          setIncidents((prev) => {
            // Avoid duplicates
            if (prev.some((i) => i.id === newInc.id)) return prev
            return [newInc, ...prev]
          })

          // Add to audit events
          setEvents((prev) => [
            {
              id: `EVT-${Date.now()}`,
              event_type: 'INCIDENT_CREATED',
              category: 'incident',
              description: `New incident registered: ${newInc.id} (${newInc.description})`,
              incident_id: newInc.id,
              resource_id: null,
              actor: 'Real-time Triage Ingestion',
              status: 'Success',
              timestamp: now,
              severity: newInc.severity,
              previous_state: 'Queue: Idle',
              new_state: `Active Incident (${newInc.id})`,
            },
            ...prev,
          ])
        }
        break
      }

      case 'INCIDENT_SEVERITY_CHANGED': {
        const { incident_id, new_severity, urgency, reason } = event.payload
        setIncidents((prev) =>
          prev.map((inc) =>
            inc.id === incident_id
              ? {
                  ...inc,
                  severity: new_severity,
                  urgency: urgency || inc.urgency,
                  description: `${inc.description} · [Escalated: ${reason || 'Urgent Triage'}]`,
                }
              : inc
          )
        )

        setEvents((prev) => [
          {
            id: `EVT-${Date.now()}`,
            event_type: 'INCIDENT_ASSESSED',
            category: 'incident',
            description: `Incident ${incident_id} severity escalated to ${new_severity.toUpperCase()}: ${reason}`,
            incident_id,
            resource_id: null,
            actor: 'Live Telemetry Triage',
            status: 'Success',
            timestamp: now,
            severity: new_severity,
            previous_state: `Severity: ${event.payload.previous_severity || 'Normal'}`,
            new_state: `Severity: ${new_severity.toUpperCase()}`,
          },
          ...prev,
        ])
        break
      }

      case 'RESOURCE_ASSIGNED': {
        const { resource_id, incident_id, assignment_reason } = event.payload
        setResources((prev) =>
          prev.map((res) =>
            res.id === resource_id
              ? {
                  ...res,
                  status: 'assigned',
                  current_assignment: incident_id,
                  availability: 'En Route',
                  last_updated: now,
                }
              : res
          )
        )

        setPlan((prev) => ({
          ...prev,
          last_updated: now,
          assignments: [
            {
              id: `ASN-${Date.now()}`,
              incident_id,
              resource_id,
              resource_type: 'police_unit',
              distance: 1.2,
              eta: 3,
              status: 'en_route',
              reason: assignment_reason || 'Dispatched via real-time stream',
            },
            ...prev.assignments,
          ],
        }))

        setEvents((prev) => [
          {
            id: `EVT-${Date.now()}`,
            event_type: 'RESOURCE_ASSIGNED',
            category: 'dispatch',
            description: `Unit ${resource_id} assigned to ${incident_id}: ${assignment_reason}`,
            incident_id,
            resource_id,
            actor: 'Automated Dispatch Stream',
            status: 'Completed',
            timestamp: now,
            severity: 'info',
            previous_state: `${resource_id}: Standby`,
            new_state: `${resource_id}: Assigned to ${incident_id}`,
          },
          ...prev,
        ])
        break
      }

      case 'RESOURCE_UNAVAILABLE': {
        const { resource_id, reason } = event.payload
        setResources((prev) =>
          prev.map((res) =>
            res.id === resource_id
              ? {
                  ...res,
                  status: 'maintenance',
                  current_assignment: null,
                  availability: 'Maintenance / Offline',
                  status_reason: reason,
                  last_updated: now,
                }
              : res
          )
        )

        setEvents((prev) => [
          {
            id: `EVT-${Date.now()}`,
            event_type: 'RESOURCE_UNAVAILABLE',
            category: 'resource',
            description: `Unit ${resource_id} reported unavailable: ${reason}`,
            incident_id: null,
            resource_id,
            actor: 'Fleet IoT Sensor OBD',
            status: 'Warning',
            timestamp: now,
            severity: 'critical',
            previous_state: `${resource_id}: Operational`,
            new_state: `${resource_id}: Maintenance (${reason})`,
          },
          ...prev,
        ])
        break
      }

      case 'RESOURCE_REASSIGNED': {
        const { resource_id, from_incident_id, to_incident_id, reason } = event.payload
        setResources((prev) =>
          prev.map((res) =>
            res.id === resource_id
              ? {
                  ...res,
                  status: 'assigned',
                  current_assignment: to_incident_id,
                  availability: 'En Route (Rerouted)',
                  last_updated: now,
                }
              : res
          )
        )

        setEvents((prev) => [
          {
            id: `EVT-${Date.now()}`,
            event_type: 'RESOURCE_ASSIGNED',
            category: 'allocation',
            description: `Unit ${resource_id} reassigned from ${from_incident_id} to ${to_incident_id}: ${reason}`,
            incident_id: to_incident_id,
            resource_id,
            actor: 'PuLP Reallocation Agent',
            status: 'Executed',
            timestamp: now,
            severity: 'critical',
            previous_state: `${resource_id} → ${from_incident_id}`,
            new_state: `${resource_id} → ${to_incident_id} (Rerouted)`,
          },
          ...prev,
        ])
        break
      }

      case 'RESPONSE_PLAN_UPDATED': {
        const payload = event.payload
        setPlan((prev) => ({
          ...prev,
          plan_id: payload.plan_id || prev.plan_id,
          status: payload.status || 'updated',
          last_updated: now,
          priority: payload.priority || prev.priority,
          objective_value: payload.objective_value || prev.objective_value,
          explanation: payload.explanation || prev.explanation,
        }))

        setEvents((prev) => [
          {
            id: `EVT-${Date.now()}`,
            event_type: 'PLAN_RECALCULATED',
            category: 'allocation',
            description: `Response Plan ${payload.plan_id} rebalanced by solver. ${payload.explanation}`,
            incident_id: null,
            resource_id: null,
            actor: 'PuLP LP Solver (CBC Engine)',
            status: 'Success',
            timestamp: now,
            severity: 'info',
            previous_state: `Active Plan`,
            new_state: `Plan ${payload.plan_id} Active`,
          },
          ...prev,
        ])
        break
      }

      case 'CRITICAL_ALERT': {
        const alert = event.payload.alert
        if (alert) {
          setAlerts((prev) => [alert, ...prev])

          if (alert.requires_human_attention) {
            setApprovals((prev) => [
              {
                id: `APR-RT-${Date.now().toString().slice(-4)}`,
                title: alert.title,
                type: 'emergency_dispatch',
                incident_id: alert.related_incident || 'INC001',
                incident_name: alert.affected_incident || 'Critical Emergency',
                resource_id: alert.related_resource || 'A01',
                resource_name: alert.affected_resource || 'Ambulance Fleet',
                status: 'pending',
                priority: 'critical',
                details: alert.description,
                reason: alert.trigger_event,
                impact: 'Hospital trauma capacity reroute to Bowring & Lady Curzon.',
                recommended_action: alert.recommended_action,
                created_at: now,
                requested_by: 'Hospital Medical Coordinator',
              },
              ...prev,
            ])
          }

          setEvents((prev) => [
            {
              id: `EVT-${Date.now()}`,
              event_type: 'HUMAN_APPROVAL_REQUIRED',
              category: 'alert',
              description: `Critical Alert: ${alert.title}. ${alert.description}`,
              incident_id: alert.related_incident,
              resource_id: alert.related_resource,
              actor: 'Safety Monitoring Sensor Grid',
              status: 'Pending',
              timestamp: now,
              severity: 'critical',
              previous_state: 'Nominal Threshold',
              new_state: 'Alert Active (Action Required)',
            },
            ...prev,
          ])
        }
        break
      }

      case 'incident.created': {
        const inc = event
        const id = inc.incident_id || inc.id
        if (id) {
          setIncidents(prev => prev.some(i => i.id === id) ? prev : [{ ...inc, id }, ...prev])
        }
        break
      }
      case 'incident.updated': {
        const inc = event
        const id = inc.incident_id || inc.id
        if (id) {
          setIncidents(prev => prev.map(i => i.id === id ? { ...i, ...inc, id } : i))
        }
        break
      }
      case 'resource.created': {
        const res = event
        const id = res.resource_id || res.id
        if (id) {
          setResources(prev => prev.some(r => r.id === id) ? prev : [{ ...res, id }, ...prev])
        }
        break
      }
      case 'resource.updated':
      case 'resource.assigned':
      case 'resource.unavailable': {
        const res = event
        const id = res.resource_id || res.id
        if (id) {
          setResources(prev => prev.map(r => r.id === id ? { ...r, ...res, id } : r))
        }
        break
      }
      case 'response_plan.created':
      case 'response_plan.updated': {
        setPlan(prev => ({ ...prev, ...event }))
        break
      }
      case 'alert.created': {
        const alt = event
        const id = alt.alert_id || alt.id
        if (id) {
          setAlerts(prev => prev.some(a => a.id === id) ? prev : [{ ...alt, id }, ...prev])
        }
        break
      }
      case 'alert.updated': {
        const alt = event
        const id = alt.alert_id || alt.id
        if (id) {
          setAlerts(prev => prev.map(a => a.id === id ? { ...a, ...alt, id } : a))
        }
        break
      }
      case 'approval.created': {
        const appr = event
        const id = appr.request_id || appr.id
        if (id) {
          setApprovals(prev => prev.some(a => a.id === id) ? prev : [{ ...appr, id }, ...prev])
        }
        break
      }
      case 'approval.approved':
      case 'approval.rejected':
      case 'approval.updated': {
        const appr = event
        const id = appr.request_id || appr.id
        if (id) {
          setApprovals(prev => prev.map(a => a.id === id ? { ...a, ...appr, id } : a))
        }
        break
      }

      default:
        break
    }
  }, [])

  // Subscribe to all incoming events from service
  useEffect(() => {
    const unsub = realtimeService.on('*', handleIncomingEvent)
    return unsub
  }, [handleIncomingEvent])

  // ── Dynamically Computed KPI Statistics (Requirement 6) ──
  const kpi = useMemo(() => {
    const active = incidents.filter((i) => i.status !== 'resolved')
    const critical = active.filter((i) => i.severity === 'critical').length
    const high = active.filter((i) => i.severity === 'high').length
    const waiting = active.filter((i) => i.status === 'waiting').length
    const total = incidents.length

    const availableRes = resources.filter((r) => r.status === 'available').length
    const assignedRes = resources.filter((r) => r.status === 'assigned').length
    const unavailableRes = resources.filter((r) => r.status === 'unavailable' || r.status === 'maintenance').length

    const pendingApprovals = approvals.filter((a) => a.status === 'pending').length

    return {
      total,
      active: active.length,
      critical,
      high,
      waiting,
      resolved: incidents.filter((i) => i.status === 'resolved').length,
      available_resources: availableRes,
      assigned_resources: assignedRes,
      unavailable_resources: unavailableRes,
      pending_approvals: pendingApprovals,
    }
  }, [incidents, resources, approvals])

  // ── Public Helpers for Controls ──
  const triggerMockEvent = useCallback((eventType, customPayload = null) => {
    return realtimeService.triggerMockEvent(eventType, customPayload)
  }, [])

  const triggerNextMockEvent = useCallback(() => {
    return realtimeService.triggerNextMockEvent()
  }, [])

  const setConnectionStatus = useCallback((status) => {
    realtimeService.setStatus(status)
  }, [])

  const toggleAutoStream = useCallback(() => {
    setAutoStreamActive((prev) => {
      if (prev) {
        realtimeService.stopAutoStream()
        return false
      } else {
        realtimeService.startAutoStream(8000)
        return true
      }
    })
  }, [])

  const dismissNotification = useCallback(() => {
    setLatestNotification(null)
  }, [])

  return {
    connectionStatus,
    setConnectionStatus,
    backendUp,
    lastUpdateTime,
    latestNotification,
    dismissNotification,
    autoStreamActive,
    toggleAutoStream,
    triggerMockEvent,
    triggerNextMockEvent,
    incidents,
    resources,
    plan,
    approvals,
    alerts,
    events,
    kpi,
  }
}
