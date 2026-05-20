import { useState } from 'react'
import { createTrip, deleteTrip } from '../utils/api.js'

function TripCreator({ onCreated, onCancel }) {
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) return setError('Give your trip a name')
    setSaving(true)
    try {
      const trip = await createTrip({ name: name.trim(), startDate, endDate })
      onCreated(trip)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card p-5 fade-up">
      <h3 className="font-display text-lg text-film-cream mb-4">New trip</h3>
      <div className="space-y-4">
        <div>
          <label className="label">Trip name</label>
          <input
            className="input"
            placeholder="e.g. Japan Spring 2024"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Start date <span className="text-film-border normal-case">(optional)</span></label>
            <input className="input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="label">End date <span className="text-film-border normal-case">(optional)</span></label>
            <input className="input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button onClick={handleCreate} disabled={saving} className="btn-primary flex-1 disabled:opacity-40">
            {saving ? 'Creating…' : 'Create trip'}
          </button>
          <button onClick={onCancel} className="btn-ghost">Cancel</button>
        </div>
      </div>
    </div>
  )
}

function TripCard({ trip, onSelect, onDelete }) {
  const formatDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  }) : null

  const start = formatDate(trip.start_date)
  const end = formatDate(trip.end_date)

  return (
    <div
      className="card p-5 cursor-pointer hover:border-film-muted transition-colors duration-200 group fade-up"
      onClick={() => onSelect(trip)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-xl text-film-cream group-hover:text-film-gold transition-colors duration-200 truncate">
            {trip.name}
          </h3>
          {start && (
            <p className="text-film-muted text-xs font-mono mt-1">
              {start}{end ? ` → ${end}` : ''}
            </p>
          )}
          {trip.curated_count > 0 && (
            <p className="text-film-amber text-xs mt-2">{trip.curated_count} photos curated</p>
          )}
        </div>
        <div className="flex items-center gap-2 ml-4">
          <span className="text-film-muted group-hover:text-film-cream text-lg transition-colors duration-200">→</span>
          <button
            onClick={e => { e.stopPropagation(); onDelete(trip.id) }}
            className="text-film-border hover:text-red-400 transition-colors duration-200 text-xs px-2 py-1"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TripsScreen({ trips, user, onSelectTrip, onTripsChange, onSignOut }) {
  const [creating, setCreating] = useState(false)

  const handleCreated = (trip) => {
    setCreating(false)
    onSelectTrip(trip)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this trip and all its photos?')) return
    try {
      await deleteTrip(id)
      onTripsChange()
    } catch (err) {
      alert('Failed to delete trip: ' + err.message)
    }
  }

  return (
    <div className="min-h-screen px-6 py-10 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-10 fade-up">
        <div>
          <h1 className="font-display text-4xl font-light text-film-cream tracking-wide">Triproll</h1>
          {user && (
            <p className="text-film-muted text-xs font-mono mt-1">
              {user.name || user.email}
            </p>
          )}
        </div>
        <div className="flex gap-3 items-center">
          {!creating && (
            <button onClick={() => setCreating(true)} className="btn-primary">+ New trip</button>
          )}
          <div className="flex items-center gap-2">
            {user?.avatarUrl && (
              <img src={user.avatarUrl} alt="" className="w-7 h-7 rounded-full" />
            )}
            <button onClick={onSignOut} className="text-film-muted hover:text-film-cream text-xs underline transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </div>

      {creating && (
        <div className="mb-6">
          <TripCreator onCreated={handleCreated} onCancel={() => setCreating(false)} />
        </div>
      )}

      {trips.length === 0 && !creating && (
        <div className="text-center py-20 fade-up">
          <p className="font-display text-2xl text-film-muted font-light italic">No trips yet</p>
          <p className="text-film-muted text-sm mt-2">Create one to get started</p>
        </div>
      )}

      <div className="space-y-3">
        {trips.map(trip => (
          <TripCard key={trip.id} trip={trip} onSelect={onSelectTrip} onDelete={handleDelete} />
        ))}
      </div>
    </div>
  )
}
