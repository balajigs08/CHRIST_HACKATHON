/**
 * Real-time WebSocket Service Abstraction (Phase 8-10)
 *
 * Connects to the FastAPI WebSocket endpoint (/api/ws) with auto-reconnect,
 * heartbeat keepalives, and observer pattern event dispatch.
 * Also preserves mock triggers for local testing and manual demonstrations.
 */

import { MOCK_REALTIME_EVENTS } from '../data/mockData.js'

class RealtimeWebSocketService {
  constructor() {
    this.status = 'connecting' // 'connected' | 'connecting' | 'disconnected' | 'reconnecting'
    this.listeners = new Map() // eventType -> Set of callbacks
    this.statusListeners = new Set() // callbacks for connection status changes
    this.autoStreamTimer = null
    this.eventPointer = 0
    this.latencyMs = 15
    this.lastPing = Date.now()
    this.socket = null
    this.reconnectTimer = null
    this.pingTimer = null
    this.reconnectAttempts = 0
    this.isExplicitDisconnect = false
  }

  getWsUrl() {
    if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const host =
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? `${window.location.hostname}:8000`
        : window.location.host
    return `${proto}://${host}/api/ws`
  }

  /**
   * Register listener for specific event types or '*' for all events
   */
  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set())
    }
    this.listeners.get(eventType).add(callback)
    return () => this.off(eventType, callback)
  }

  /**
   * Remove listener
   */
  off(eventType, callback) {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType).delete(callback)
    }
  }

  /**
   * Subscribe to connection status changes
   */
  onStatusChange(callback) {
    this.statusListeners.add(callback)
    callback(this.status, { latency: this.latencyMs })
    return () => this.statusListeners.delete(callback)
  }

  /**
   * Set connection status and notify listeners
   */
  setStatus(newStatus) {
    if (this.status === newStatus) return
    this.status = newStatus
    this.statusListeners.forEach((cb) => {
      try {
        cb(this.status, { latency: this.latencyMs })
      } catch (err) {
        console.error('[RealtimeService] Error in statusListener:', err)
      }
    })
  }

  /**
   * Dispatch event to all relevant listeners
   */
  emit(eventType, data) {
    const enrichedData = {
      ...data,
      received_at: new Date().toISOString(),
    }

    // Specific listeners
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType).forEach((cb) => {
        try {
          cb(enrichedData)
        } catch (err) {
          console.error(`[RealtimeService] Error in listener for ${eventType}:`, err)
        }
      })
    }

    // Wildcard listeners
    if (this.listeners.has('*')) {
      this.listeners.get('*').forEach((cb) => {
        try {
          cb({ type: eventType, ...enrichedData })
        } catch (err) {
          console.error(`[RealtimeService] Error in wildcard listener:`, err)
        }
      })
    }
  }

  /**
   * Connect to real backend WebSocket
   */
  connect() {
    this.isExplicitDisconnect = false
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return
    }

    this.setStatus(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting')

    try {
      const url = this.getWsUrl()
      this.socket = new WebSocket(url)

      this.socket.onopen = () => {
        this.reconnectAttempts = 0
        this.setStatus('connected')
        this.startKeepalive()
      }

      this.socket.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data)
          this.handleServerMessage(raw)
        } catch (e) {
          // ignore non-json messages
        }
      }

      this.socket.onclose = () => {
        this.stopKeepalive()
        if (!this.isExplicitDisconnect) {
          this.setStatus('disconnected')
          this.scheduleReconnect()
        }
      }

      this.socket.onerror = () => {
        if (this.socket) {
          this.socket.close()
        }
      }
    } catch (err) {
      this.setStatus('disconnected')
      this.scheduleReconnect()
    }
  }

  handleServerMessage(msg) {
    const eventName = msg.event || msg.type
    const eventData = msg.data || msg.payload || {}
    const now = msg.timestamp || new Date().toISOString()

    // Measure latency on pong
    if (eventName === 'pong') {
      this.latencyMs = Math.max(5, Date.now() - this.lastPing)
      return
    }

    // Emit standard raw event
    this.emit(eventName, {
      ...eventData,
      _event: eventName,
      timestamp: now,
    })

    // Bridge backend events to UI event models
    if (eventName === 'incident.created') {
      const inc = eventData
      this.emit('NEW_INCIDENT', {
        id: `RTE-${Date.now()}`,
        type: 'NEW_INCIDENT',
        title: `New Incident: ${inc.type || 'Incident'}`,
        severity: inc.severity || 'high',
        timestamp: now,
        payload: {
          incident: {
            id: inc.incident_id || inc.id,
            title: `${inc.type} - ${inc.location}`,
            type: inc.type,
            location: inc.location,
            severity: inc.severity,
            urgency: inc.urgency || 5,
            status: inc.status || 'reported',
            description: inc.description,
            required_resources: inc.required_resources || [],
          },
        },
      })
    } else if (eventName === 'incident.updated') {
      const inc = eventData
      this.emit('INCIDENT_SEVERITY_CHANGED', {
        id: `RTE-${Date.now()}`,
        type: 'INCIDENT_SEVERITY_CHANGED',
        title: `Incident Updated: ${inc.type || inc.incident_id}`,
        severity: inc.severity || 'high',
        timestamp: now,
        payload: {
          incident_id: inc.incident_id || inc.id,
          new_severity: inc.severity,
          urgency: inc.urgency,
          reason: inc.description || 'Status update',
        },
      })
    } else if (eventName === 'resource.assigned') {
      const res = eventData
      this.emit('RESOURCE_ASSIGNED', {
        id: `RTE-${Date.now()}`,
        type: 'RESOURCE_ASSIGNED',
        title: `Resource Assigned: ${res.resource_id}`,
        severity: 'info',
        timestamp: now,
        payload: {
          resource_id: res.resource_id || res.id,
          incident_id: res.assigned_incident_id,
          assignment_reason: 'Assigned via dispatch',
        },
      })
    } else if (eventName === 'resource.unavailable') {
      const res = eventData
      this.emit('RESOURCE_UNAVAILABLE', {
        id: `RTE-${Date.now()}`,
        type: 'RESOURCE_UNAVAILABLE',
        title: `Resource Unavailable: ${res.resource_id}`,
        severity: 'critical',
        timestamp: now,
        payload: {
          resource_id: res.resource_id || res.id,
          reason: 'Maintenance / Offline',
        },
      })
    } else if (eventName === 'response_plan.updated' || eventName === 'response_plan.created') {
      const plan = eventData
      this.emit('RESPONSE_PLAN_UPDATED', {
        id: `RTE-${Date.now()}`,
        type: 'RESPONSE_PLAN_UPDATED',
        title: `Response Plan ${plan.plan_id || ''} Updated`,
        severity: 'info',
        timestamp: now,
        payload: {
          plan_id: plan.plan_id || plan.id,
          status: plan.status || 'active',
          explanation: 'Response plan synchronized with backend',
        },
      })
    } else if (eventName === 'alert.created') {
      const alt = eventData
      this.emit('CRITICAL_ALERT', {
        id: `RTE-${Date.now()}`,
        type: 'CRITICAL_ALERT',
        title: alt.title || 'Emergency Alert',
        severity: alt.severity || 'critical',
        timestamp: now,
        payload: {
          alert: {
            id: alt.alert_id || alt.id,
            title: alt.title,
            description: alt.description,
            severity: alt.severity || 'critical',
            status: alt.status || 'active',
            requires_human_attention: alt.requires_human_attention ?? true,
          },
        },
      })
    } else if (eventName === 'approval.created') {
      const appr = eventData
      this.emit('APPROVAL_REQUESTED', {
        id: `RTE-${Date.now()}`,
        type: 'APPROVAL_REQUESTED',
        title: `Approval Required: ${appr.type}`,
        severity: 'critical',
        timestamp: now,
        payload: appr,
      })
    }
  }

  startKeepalive() {
    this.stopKeepalive()
    this.pingTimer = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.lastPing = Date.now()
        this.socket.send(JSON.stringify({ action: 'ping' }))
      }
    }, 20000)
  }

  stopKeepalive() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return
    this.reconnectAttempts += 1
    const delay = Math.min(10000, 1000 * 1.5 ** this.reconnectAttempts)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)
  }

  /**
   * Disconnect
   */
  disconnect() {
    this.isExplicitDisconnect = true
    this.stopKeepalive()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.stopAutoStream()
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
    this.setStatus('disconnected')
  }

  /**
   * Simulate reconnect flow
   */
  reconnect() {
    this.disconnect()
    this.connect()
  }

  /**
   * Manually trigger a mock event
   */
  triggerMockEvent(eventType, customPayload = null) {
    const predefined = MOCK_REALTIME_EVENTS.find((e) => e.type === eventType)
    const payload = customPayload || predefined?.payload || {}
    const title = predefined?.title || `Live Event: ${eventType}`
    const severity = predefined?.severity || 'info'

    const event = {
      id: `RTE-${Date.now()}`,
      type: eventType,
      title,
      severity,
      timestamp: new Date().toISOString(),
      payload,
    }

    this.emit(eventType, event)
    return event
  }

  /**
   * Trigger the next event in the predefined mock stream
   */
  triggerNextMockEvent() {
    const event = MOCK_REALTIME_EVENTS[this.eventPointer]
    this.eventPointer = (this.eventPointer + 1) % MOCK_REALTIME_EVENTS.length

    const enriched = {
      ...event,
      timestamp: new Date().toISOString(),
    }

    this.emit(event.type, enriched)
    return enriched
  }

  /**
   * Start automated background mock event stream
   */
  startAutoStream(intervalMs = 12000) {
    if (this.autoStreamTimer) return
    this.autoStreamTimer = setInterval(() => {
      this.triggerNextMockEvent()
    }, intervalMs)
  }

  /**
   * Stop automated background stream
   */
  stopAutoStream() {
    if (this.autoStreamTimer) {
      clearInterval(this.autoStreamTimer)
      this.autoStreamTimer = null
    }
  }
}

// Singleton export
export const realtimeService = new RealtimeWebSocketService()
