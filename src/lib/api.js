import axios from 'axios'
import { getToken, clearAuth } from './auth'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT on every request
api.interceptors.request.use(config => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// On 401, clear auth and reload
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      clearAuth()
      window.location.href = '/'
    }
    return Promise.reject(err)
  },
)

// ── Auth ──────────────────────────────────────────
export const authApi = {
  me: () => api.get('/auth/me'),
}

// ── Offers ────────────────────────────────────────
export const offersApi = {
  list:   (params) => api.get('/offers', { params }),
  get:    (id)     => api.get(`/offers/${id}`),
  create: (data)   => api.post('/offers', data),
  update: (id, d)  => api.put(`/offers/${id}`, d),
  delete: (id)     => api.delete(`/offers/${id}`),
}

// ── Trades ────────────────────────────────────────
export const tradesApi = {
  list:           ()         => api.get('/trades'),
  get:            (id)       => api.get(`/trades/${id}`),
  create:         (data)     => api.post('/trades', data),
  confirmPayment: (id)       => api.patch(`/trades/${id}/confirm-payment`),
  release:        (id)       => api.patch(`/trades/${id}/release`),
  dispute:        (id, data) => api.patch(`/trades/${id}/dispute`, data),
  cancel:         (id)       => api.patch(`/trades/${id}/cancel`),
  getMessages:    (id)       => api.get(`/trades/${id}/messages`),
  sendMessage:    (id, msg)  => api.post(`/trades/${id}/messages`, { message: msg }),
}

// ── Dashboard ─────────────────────────────────────
export const dashboardApi = {
  get: () => api.get('/dashboard'),
}

// ── Balance ───────────────────────────────────────
export const balanceApi = {
  get:     () => api.get('/balance'),
  deposit: (data) => api.post('/deposits', data),
  deposits: () => api.get('/deposits'),
}

export default api
