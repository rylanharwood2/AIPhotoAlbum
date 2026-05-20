import { useState, useEffect } from 'react'
import { getAnalysis, getDownloadUrl } from '../utils/api.js'

export default function AlbumScreen({ trip, onBack, onDone, onReupload }) {
  const [curatedPhotos, setCuratedPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadAnalysis()
  }, [trip.id])

  const loadAnalysis = async () => {
    setLoading(true)
    try {
      const { curatedPhotos: photos } = await getAnalysis(trip.id)
      setCuratedPhotos(photos || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    // Navigate to the download endpoint — browser handles the zip download
    window.location.href = getDownloadUrl(trip.id)
    if (onDone) onDone()
  }

  return (
    <div className="min-h-screen px-6 py-10 max-w-2xl mx-auto">
      <button onClick={onBack} className="text-film-muted text-sm hover:text-film-cream mb-8 block">
        ← Back
      </button>

      {loading && (
        <div className="py-20 text-center">
          <span className="pulse-amber text-film-amber font-mono text-sm">Loading…</span>
        </div>
      )}

      {error && (
        <div className="card p-3 border-red-900/50 mb-6">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {!loading && (
        <div className="fade-up">
          <h2 className="font-display text-3xl text-film-cream mb-2">Your curated album</h2>
          <p className="text-film-muted text-sm mb-8">
            {curatedPhotos.length} photos from {trip.name}, named in order (01.jpg, 02.jpg…)
          </p>

          {/* Preview grid */}
          {curatedPhotos.length > 0 && (
            <div className="columns-4 gap-1.5 space-y-1.5 mb-8">
              {curatedPhotos.slice(0, 16).map((photo, i) => (
                <div key={photo.id} className="break-inside-avoid rounded overflow-hidden relative">
                  <img src={photo.cloudinary_url} alt="" className="w-full h-auto block" loading="lazy" />
                  <div className="absolute top-1 left-1 bg-black/60 text-film-cream text-xs font-mono px-1 rounded">
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  {photo.curation_reason?.includes('SIMILAR TO') && (
                    <div className="absolute bottom-1 right-1 bg-yellow-600/80 text-white text-xs px-1 rounded">
                      similar
                    </div>
                  )}
                </div>
              ))}
              {curatedPhotos.length > 16 && (
                <div className="break-inside-avoid rounded bg-film-surface border border-film-border flex items-center justify-center aspect-square">
                  <span className="text-film-muted text-sm font-mono">+{curatedPhotos.length - 16}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleDownload}
              disabled={curatedPhotos.length === 0}
              className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Download zip
            </button>
            <button onClick={onReupload} className="btn-ghost">Re-upload photos</button>
            <button onClick={onBack} className="btn-ghost">Back</button>
          </div>

          {curatedPhotos.some(p => p.curation_reason?.includes('SIMILAR TO')) && (
            <p className="text-film-muted text-xs mt-4">
              Photos marked <span className="text-yellow-500">similar</span> are near-identical shots Claude couldn't choose between — you can remove one after downloading.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
