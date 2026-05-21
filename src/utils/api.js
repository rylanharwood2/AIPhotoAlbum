const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// Token stored in localStorage so it survives page refreshes
// and works cross-domain without cookie restrictions
export function getToken() {
  return localStorage.getItem('session_token')
}

export function saveToken(token) {
  localStorage.setItem('session_token', token)
}

export function clearToken() {
  localStorage.removeItem('session_token')
}

async function request(path, options = {}) {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      // Send token as Authorization header — works cross-domain unlike cookies
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  })

  if (res.status === 401) throw new Error('NOT_AUTHENTICATED')
  if (res.status === 429) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'RATE_LIMIT_EXCEEDED')
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Request failed: ${res.status}`)
  }

  return res.json()
}

// Auth
export const getMe = () => request('/auth/me')
export const logout = () => request('/auth/logout', { method: 'POST' })
export const getLoginUrl = () => `${BASE}/auth/google`

// Trips
export const getTrips = () => request('/trips')
export const createTrip = (data) => request('/trips', { method: 'POST', body: JSON.stringify(data) })
export const deleteTrip = (id) => request(`/trips/${id}`, { method: 'DELETE' })

// Photos
export const getPhotos = (tripId) => request(`/photos/${tripId}`)
export const getAnalysis = (tripId) => request(`/analyze/${tripId}`)
export const deletePhotos = (tripId) => request(`/photos/${tripId}`, { method: 'DELETE' })

// Upload from disk
export async function uploadPhotosFromDisk(tripId, files) {
  const token = getToken()
  const form = new FormData()
  for (const file of files) {
    form.append('photos', file)
    form.append(`timestamp_${file.name}`, new Date(file.lastModified).toISOString())
  }

  const res = await fetch(`${BASE}/photos/${tripId}/upload`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: form,
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Upload failed')
  }
  return res.json()
}

// Import from Google Photos Picker
export const importFromPicker = (tripId, photos) =>
  request(`/photos/${tripId}/import`, { method: 'POST', body: JSON.stringify({ photos }) })

// Analysis — returns an EventSource for live progress
export function runAnalysis(tripId) {
  const token = getToken()
  // EventSource doesn't support custom headers, so we pass token as query param
  return new EventSource(`${BASE}/analyze/${tripId}/run?token=${token}`, { withCredentials: true })
}

// Download zip
export const getDownloadUrl = (tripId) => {
  const token = getToken()
  return `${BASE}/analyze/${tripId}/download?token=${token}`
}
