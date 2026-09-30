/**
 * Real-time WebSocket Service Abstraction (Phase 11)
 *
 * Implements an observer pattern that matches standard WebSocket client behavior.
 * In Phase 11 (mock mode), it simulates network lifecycle (connected, connecting,
 * disconnected, reconnecting) and dispatches mock telemetry events.
 *
 * When a real FastAPI WebSocket endpoint is available later, only the socket
 * transport layer in this service needs to be toggled, with zero consumer code changes.
 */

import { MOCK_REALTIME_EVENTS } from '../data/mockData.js'

class RealtimeWebSocketService {
  constructor() {
    this.status = 'connected' // 'connected' | 'connecting' | 'disconnected' | 'reconnecting'
    this.listeners = new Map() // eventType -> Set of callbacks
    this.statusListeners = new Set() // callbacks for connection status changes
    this.autoStreamTimer = null
    this.eventPointer = 0
    this.latencyMs = 18
    this.lastPing = Date.now()
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
    // Immediately emit current status
    callback(this.status, { latency: this.latencyMs })
    return () => this.statusListeners.delete(callback)
  }

  /**
   * Set connection status and notify listeners
   */
  setStatus(newStatus) {
    if (this.status === newStatus) return
    this.status = newStatus
    this.statusListeners.forEach((cb) => cb(this.status, { latency: this.latencyMs }))
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
   * Connect (or simulate connection)
   */
  connect() {
    if (this.status === 'connected') return

    this.setStatus('connecting')
    setTimeout(() => {
      this.setStatus('connected')
    }, 600)
  }

  /**
   * Disconnect
   */
  disconnect() {
    this.stopAutoStream()
    this.setStatus('disconnected')
  }

  /**
   * Simulate reconnect flow
   */
  reconnect() {
    this.setStatus('reconnecting')
    setTimeout(() => {
      this.setStatus('connected')
    }, 1200)
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
      if (this.status === 'connected') {
        this.triggerNextMockEvent()
      }
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
