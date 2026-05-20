// All calls to the Triproll backend
// VITE_API_URL is set in your Vercel environment variables

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include', // send session cookie on every request
    headers: { 'Content-Type': 'application/json', ...options.headers },
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
export const deletePhotos = (tripId) => request(`/photos/${tripId}`, { method: 'DELETE' })

// Upload from disk — sends as multipart form data
export async function uploadPhotosFromDisk(tripId, files) {
  const form = new FormData()
  for (const file of files) {
    form.append('photos', file)
    // Include timestamp as a separate field so the server can store it
    form.append(`timestamp_${file.name}`, new Date(file.lastModified).toISOString())
  }

  const res = await fetch(`${BASE}/photos/${tripId}/upload`, {
    method: 'POST',
    credentials: 'include',
    body: form, // Don't set Content-Type — browser sets multipart boundary automatically
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
  return new EventSource(`${BASE}/analyze/${tripId}/run`, { withCredentials: true })
}

// Get saved analysis
export const getAnalysis = (tripId) => request(`/analyze/${tripId}`)

// Download zip — just navigate to this URL
export const getDownloadUrl = (tripId) => `${BASE}/analyze/${tripId}/download`
