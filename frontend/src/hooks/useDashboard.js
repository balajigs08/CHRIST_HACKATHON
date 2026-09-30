import { useCallback, useEffect, useRef, useState } from 'react'
import { api, errorMessage } from '../services/api.js'

const wsUrl = () => {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}/ws/dashboard`
}

/** Live dashboard state: initial REST load, then WebSocket pushes (auto-reconnect). */
export function useDashboard() {
  const [state, setState] = useState(null)
  const [connected, setConnected] = useState(false)
  const [backendUp, setBackendUp] = useState(true)
  const [toasts, setToasts] = useState([])
  const [lastEvent, setLastEvent] = useState(null)
  const retry = useRef(0)

  const toast = useCallback((text, kind = 'info') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(t => [...t.slice(-4), { id, text, kind }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 7000)
  }, [])

  const refresh = useCallback(async () => {
    try {
      setState(await api.state())
      setBackendUp(true)
    } catch {
      setBackendUp(false)
    }
  }, [])

  useEffect(() => {
    let ws, timer, closed = false

    const connect = () => {
      ws = new WebSocket(wsUrl())

      ws.onopen = () => {
        retry.current = 0
        setConnected(true)
        setBackendUp(true)
        refresh()
      }

      ws.onmessage = m => {
        const msg = JSON.parse(m.data)
        setLastEvent({ type: msg.type, ts: Date.now() })

        if (msg.type === 'state_snapshot') {
          setState(msg.snapshot)
        } else if (msg.type === 'boundary_collapse') {
          toast(`⚠ BOUNDARY COLLAPSE: ${msg.event?.description || 'No resources of a type remain'}`, 'critical')
        } else if (msg.type === 'human_approval_required') {
          toast('🔴 Human approval required — resource shortage detected', 'critical')
        } else if (msg.type === 'plan_recalculated') {
          toast('📋 Response plan updated by optimizer', 'info')
        } else if (msg.event) {
          const kindMap = {
            resource_unavailable: 'warn',
            incident_created:     'info',
            resource_reallocated: 'warn',
          }
          const kind = kindMap[msg.type] || 'info'
          toast(msg.event.description, kind)
        }
      }

      ws.onclose = () => {
        setConnected(false)
        if (closed) return
        retry.current += 1
        const delay = Math.min(8000, 500 * 2 ** retry.current)
        timer = setTimeout(connect, delay)
      }

      ws.onerror = () => ws.close()
    }

    refresh()
    connect()

    // Keepalive ping every 25s
    const ping = setInterval(() => {
      if (ws?.readyState === 1) ws.send('ping')
    }, 25000)

    // Fallback polling if WebSocket stays down
    const poll = setInterval(() => {
      if (!connected) refresh()
    }, 15000)

    return () => {
      closed = true
      clearTimeout(timer)
      clearInterval(ping)
      clearInterval(poll)
      ws?.close()
    }
  }, [refresh, toast])

  const run = useCallback(async fn => {
    try {
      await fn()
      if (!connected) await refresh()
    } catch (e) {
      toast(errorMessage(e), 'critical')
    }
  }, [connected, refresh, toast])

  return { state, connected, backendUp, toasts, lastEvent, run, toast }
}
