import { useState, useEffect } from 'react'
import { getPhotos, uploadPhotosFromDisk, importFromPicker, getAnalysis } from '../utils/api.js'
import { openGooglePhotosPicker } from '../utils/picker.js'

export default function PhotosScreen({ trip, onBack, onStartAnalysis, onViewAlbum }) {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [hasAnalysis, setHasAnalysis] = useState(false)

  useEffect(() => { loadPhotos() }, [trip.id])

  const loadPhotos = async () => {
    setLoading(true)
    try {
      const [tripPhotos, analysis] = await Promise.all([
        getPhotos(trip.id),
        getAnalysis(trip.id).catch(() => ({ curatedPhotos: [] })),
      ])
      setPhotos(tripPhotos)
      setHasAnalysis(analysis.curatedPhotos?.length > 0)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDiskUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return
    setUploading(true)
    setError('')
    setUploadProgress(`Uploading ${files.length} photos…`)
    try {
      const { errors } = await uploadPhotosFromDisk(trip.id, files)
      if (errors.length > 0) setError(`${errors.length} photos failed to upload`)
      setUploadProgress('')
      await loadPhotos()
    } catch (err) {
      setError(err.message)
      setUploadProgress('')
    } finally {
      setUploading(false)
    }
  }

  const handlePickerImport = async () => {
    setError('')
    setUploading(true)
    setUploadProgress('Opening Google Photos picker…')
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/auth/google-token`,
        { credentials: 'include' }
      )
      const { accessToken } = await res.json()
      setUploadProgress('Waiting for photo selection…')
      const pickerPhotos = await openGooglePhotosPicker(accessToken)
      if (pickerPhotos.length === 0) { setUploadProgress(''); setUploading(false); return }
      setUploadProgress(`Importing ${pickerPhotos.length} photos from Google Photos…`)
      const { errors } = await importFromPicker(trip.id, pickerPhotos)
      if (errors.length > 0) setError(`${errors.length} photos failed to import`)
      setUploadProgress('')
      await loadPhotos()
    } catch (err) {
      setError(err.message)
      setUploadProgress('')
    } finally {
      setUploading(false)
    }
  }

  const formatDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-20 bg-film-bg/90 backdrop-blur border-b border-film-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-film-muted hover:text-film-cream text-sm transition-colors">← Back</button>
          <div>
            <h2 className="font-display text-lg text-film-cream leading-tight">{trip.name}</h2>
            {trip.start_date && (
              <p className="text-film-muted text-xs font-mono">
                {formatDate(trip.start_date)}{trip.end_date ? ` — ${formatDate(trip.end_date)}` : ''}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {photos.length > 0 && (
            <>
              <span className="text-film-muted text-xs font-mono">{photos.length} photos</span>
              {hasAnalysis ? (
                <button onClick={onViewAlbum} className="btn-primary">View album →</button>
              ) : (
                <button onClick={onStartAnalysis} className="btn-primary">Curate with AI →</button>
              )}
              <label className="text-film-muted hover:text-film-amber text-xs transition-colors cursor-pointer">
                + Add more
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleDiskUpload} />
              </label>
            </>
          )}
        </div>
      </div>

      <div className="px-6 py-6 max-w-6xl mx-auto">
        {loading && <div className="py-20 text-center"><span className="pulse-amber text-film-amber font-mono text-sm">Loading photos…</span></div>}
        {uploading && <div className="py-6 text-center fade-in"><span className="pulse-amber text-film-amber font-mono text-sm">{uploadProgress}</span></div>}
        {error && <div className="card p-3 border-red-900/50 mb-6"><p className="text-red-400 text-sm">{error}</p></div>}

        {!loading && !uploading && photos.length === 0 && (
          <div className="py-20 text-center fade-in">
            <p className="font-display text-2xl text-film-cream mb-2">Add your photos</p>
            <p className="text-film-muted text-sm mb-8">Choose how you'd like to add photos for this trip</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button onClick={handlePickerImport} className="btn-primary px-8 py-3">
                Pick from Google Photos
              </button>
              <label className="btn-ghost cursor-pointer px-6 py-2.5 text-sm">
                Upload from computer
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleDiskUpload} />
              </label>
            </div>
            <p className="text-film-muted text-xs mt-4">You can select an entire folder at once when uploading from computer</p>
          </div>
        )}

        {!loading && photos.length > 0 && (
          <div className="fade-in">
            <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-2 space-y-2">
              {photos.map(photo => (
                <div key={photo.id} className="photo-card break-inside-avoid cursor-pointer rounded overflow-hidden bg-film-surface" onClick={() => setSelected(photo)}>
                  <img src={photo.cloudinary_url} alt={photo.filename} className="w-full h-auto block" loading="lazy" />
                </div>
              ))}
            </div>
            {!hasAnalysis && (
              <div className="mt-10 text-center">
                <button onClick={onStartAnalysis} className="btn-primary px-8 py-3">Curate album with AI →</button>
                <p className="text-film-muted text-xs mt-2">Claude will select the best photos from your {photos.length} uploaded shots</p>
              </div>
            )}
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 fade-in" onClick={() => setSelected(null)}>
          <div className="relative max-w-4xl max-h-full" onClick={e => e.stopPropagation()}>
            <img src={selected.cloudinary_url} alt={selected.filename} className="max-w-full max-h-[85vh] object-contain rounded" />
            <div className="flex items-center justify-between mt-2 px-1">
              <p className="text-film-muted text-xs font-mono">
                {selected.filename}{selected.taken_at ? ` · ${new Date(selected.taken_at).toLocaleString()}` : ''}
              </p>
              <button onClick={() => setSelected(null)} className="text-film-muted hover:text-film-cream text-xs">✕ Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
