import axios from 'axios'

const http = axios.create({ baseURL: import.meta.env.VITE_API_URL || '', timeout: 30000 })

export function errorMessage(err) {
  if (err.response?.data?.error) return err.response.data.error.message
  if (err.code === 'ECONNABORTED') return 'Request timed out'
  if (!err.response) return 'Backend unavailable — is the API running on port 8000?'
  return err.message
}

const post = (url, body = {}) => http.post(url, body).then((r) => r.data)

export const api = {
  state: () => http.get('/api/state').then((r) => r.data),
  simIncident: (kind) => post('/api/simulation/incident', { kind }),
  breakAmbulance: () => post('/api/simulation/break-ambulance'),
  restoreAmbulance: () => post('/api/simulation/restore-ambulance'),
  recalc: () => post('/api/plan/recalculate'),
  reset: () => post('/api/simulation/reset'),
  demoT0: () => post('/api/simulation/demo-t0'),
  demoT10: () => post('/api/simulation/demo-t10'),
  advance: (minutes) => post('/api/simulation/advance', { minutes }),
  createIncident: (description) => post('/api/incidents', { description }),
  resolveIncident: (id) => http.put(`/api/incidents/${id}`, { status: 'resolved' }).then((r) => r.data),
  approve: (approval_id) => post('/api/approval/approve', { approval_id }),
  reject: (approval_id) => post('/api/approval/reject', { approval_id }),
}
