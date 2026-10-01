import axios from 'axios'

const http = axios.create({ baseURL: import.meta.env.VITE_API_URL || '', timeout: 30000 })

// Automatically attach JWT token to all requests if authenticated
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('crisis_auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export function errorMessage(err) {
  if (err.response?.data?.detail) return typeof err.response.data.detail === 'string' ? err.response.data.detail : JSON.stringify(err.response.data.detail)
  if (err.response?.data?.error?.message) return err.response.data.error.message
  if (err.code === 'ECONNABORTED') return 'Request timed out'
  if (!err.response) return 'Backend unavailable — is the API running on port 8000?'
  return err.message
}

const post = (url, body = {}) => http.post(url, body).then((r) => r.data)
const get = (url, params = {}) => http.get(url, { params }).then((r) => r.data)
const put = (url, body = {}) => http.put(url, body).then((r) => r.data)
const del = (url) => http.delete(url).then((r) => r.data)

export const api = {
  // Authentication & OTP (Citizen & Regional Authority)
  auth: {
    register: (data) => post('/api/auth/register', data),
    verifyOtp: (data) => post('/api/auth/verify-otp', data),
    resendOtp: (data) => post('/api/auth/resend-otp', data),
    login: (data) => post('/api/auth/login', data),
    authorityLogin: (data) => post('/api/auth/authority-login', data),
    authorityRegister: (data) => post('/api/auth/authority-register', data),
    authorityStatus: () => get('/api/auth/authority-status'),
    me: () => get('/api/auth/me'),
  },

  // System & Health
  health: () => get('/api/health'),

  wsStatus: () => get('/api/ws/status'),
  state: () => get('/api/state').catch(() => null),

  // Incidents (Phase 3)
  incidents: {
    list: (params) => get('/api/incidents/', params),
    get: (id) => get(`/api/incidents/${id}`),
    create: (data) => post('/api/incidents/', data),
    update: (id, data) => put(`/api/incidents/${id}`, data),
    delete: (id) => del(`/api/incidents/${id}`),
  },

  // Resources (Phase 4)
  resources: {
    list: (params) => get('/api/resources/', params),
    get: (id) => get(`/api/resources/${id}`),
    create: (data) => post('/api/resources/', data),
    update: (id, data) => put(`/api/resources/${id}`, data),
    delete: (id) => del(`/api/resources/${id}`),
    eta: (resourceId, incidentId) => get(`/api/resources/${resourceId}/eta/${incidentId}`),
  },

  // Routes & Location (Phase 5)
  routes: {
    estimate: (params) => get('/api/routes/estimate', params),
  },

  // Response Plans (Phase 6)
  plans: {
    list: () => get('/api/response-plans/'),
    get: (id) => get(`/api/response-plans/${id}`),
    create: (data) => post('/api/response-plans/', data),
    update: (id, data) => put(`/api/response-plans/${id}`, data),
    summary: (id) => get(`/api/response-plans/${id}/summary`),
  },

  // Events & Audit (Phase 7)
  events: {
    list: (params) => get('/api/events/', params),
    get: (id) => get(`/api/events/${id}`),
    create: (data) => post('/api/events/', data),
    byIncident: (incidentId) => get(`/api/incidents/${incidentId}/events`),
    byResource: (resourceId) => get(`/api/resources/${resourceId}/events`),
  },

  // Alerts (Phase 9)
  alerts: {
    list: (params) => get('/api/alerts/', params),
    get: (id) => get(`/api/alerts/${id}`),
    create: (data) => post('/api/alerts/', data),
    update: (id, data) => put(`/api/alerts/${id}`, data),
    resolve: (id) => put(`/api/alerts/${id}`, { status: 'resolved', requires_human_attention: false }),
  },

  // Human Approvals (Phase 9)
  approvals: {
    list: (params) => get('/api/approvals/', params),
    get: (id) => get(`/api/approvals/${id}`),
    create: (data) => post('/api/approvals/', data),
    update: (id, data) => put(`/api/approvals/${id}`, data),
    approve: (id, note) => put(`/api/approvals/${id}`, { status: 'approved', note }),
    reject: (id, note) => put(`/api/approvals/${id}`, { status: 'rejected', note }),
  },

  // Legacy convenience helpers
  createIncident: (description) =>
    post('/api/incidents/', {
      type: 'Emergency',
      description,
      location: 'City Center',
      latitude: 12.9716,
      longitude: 77.5946,
      severity: 'medium',
      urgency: 5,
      status: 'reported',
      required_resources: ['ambulance'],
    }),
  resolveIncident: (id) => put(`/api/incidents/${id}`, { status: 'resolved' }),
  approve: (approval_id, note) => put(`/api/approvals/${approval_id}`, { status: 'approved', note }),
  reject: (approval_id, note) => put(`/api/approvals/${approval_id}`, { status: 'rejected', note }),
  simIncident: (kind) => post('/api/simulation/incident', { kind }),
  breakAmbulance: () => post('/api/simulation/break-ambulance'),
  restoreAmbulance: () => post('/api/simulation/restore-ambulance'),
  recalc: () => post('/api/plan/recalculate'),
  reset: () => post('/api/simulation/reset'),
  demoT0: () => post('/api/simulation/demo-t0'),
  demoT10: () => post('/api/simulation/demo-t10'),
  advance: (minutes) => post('/api/simulation/advance', { minutes }),
}

