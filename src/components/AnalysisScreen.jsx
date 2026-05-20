import { useState, useEffect, useRef } from 'react'
import { runAnalysis } from '../utils/api.js'

function ComparisonPrompt({ photoA, photoB, onPick }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-6 fade-in">
      <p className="text-film-muted text-xs uppercase tracking-widest mb-2">Claude needs your help</p>
      <h3 className="font-display text-2xl text-film-cream mb-1">Which photo is better?</h3>
      <p className="text-film-muted text-sm mb-8">These two are the same shot — Claude can't decide</p>
      <div className="grid grid-cols-2 gap-4 w-full max-w-3xl">
        {[photoA, photoB].map((photo, i) => (
          <button key={photo.id} onClick={() => onPick(photo.id)}
            className="group relative rounded-lg overflow-hidden border-2 border-film-border hover:border-film-amber transition-colors duration-200">
            <img src={photo.url} alt={`Option ${i + 1}`} className="w-full aspect-[4/3] object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200" />
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60">
              <p className="text-film-cream text-sm">Option {i + 1}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function LogLine({ text, status }) {
  const color = status === 'done' ? 'text-film-cream' : status === 'working' ? 'text-film-amber' : 'text-film-muted'
  const icon = status === 'done' ? '✓' : status === 'working' ? '◐' : '·'
  return (
    <div className={`flex gap-2 text-xs font-mono ${color} fade-up`}>
      <span className={status === 'working' ? 'pulse-amber' : ''}>{icon}</span>
      <span>{text}</span>
    </div>
  )
}

export default function AnalysisScreen({ trip, onComplete, onBack }) {
  const [log, setLog] = useState([])
  const [comparison, setComparison] = useState(null)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [curatedPhotos, setCuratedPhotos] = useState([])
  const logRef = useRef(null)
  const analysisRef = useRef(false)

  const addLog = (text, status = 'done') => {
    setLog(prev => [...prev, { text, status, id: Date.now() + Math.random() }])
    setTimeout(() => logRef.current?.scrollTo({ top: 9999, behavior: 'smooth' }), 50)
  }

  useEffect(() => {
    if (analysisRef.current) return
    analysisRef.current = true
    startAnalysis()
  }, [])

  const startAnalysis = () => {
    // runAnalysis returns an EventSource (server-sent events stream)
    const es = runAnalysis(trip.id)

    es.onmessage = (e) => {
      const msg = JSON.parse(e.data)

      if (msg.type === 'log') {
        addLog(msg.message, 'done')
      } else if (msg.type === 'comparison') {
        setComparison({ photoA: msg.photoA, photoB: msg.photoB })
      } else if (msg.type === 'done') {
        setCuratedPhotos(msg.curatedPhotos || [])
        addLog(`Done — ${msg.curatedPhotos?.length || 0} photos selected`, 'done')
        setDone(true)
        es.close()
      } else if (msg.type === 'error') {
        setError(msg.message)
        es.close()
      }
    }

    es.onerror = () => {
      setError('Connection to server lost. Please try again.')
      es.close()
    }
  }

  const handlePick = (winnerId) => {
    setComparison(null)
    // Note: for now we just dismiss the comparison — the backend already
    // included both in the unique set. Future: send pick back to backend.
  }

  return (
    <div className="min-h-screen px-6 py-10 max-w-2xl mx-auto">
      {comparison && (
        <ComparisonPrompt photoA={comparison.photoA} photoB={comparison.photoB} onPick={handlePick} />
      )}

      <div className="flex items-start justify-between mb-8 fade-up">
        <div>
          <button onClick={onBack} className="text-film-muted text-sm hover:text-film-cream mb-3 block">
            ← {trip.name}
          </button>
          <h2 className="font-display text-3xl text-film-cream">
            {done ? 'Curation complete' : 'Analyzing…'}
          </h2>
          <p className="text-film-muted text-sm mt-1">
            {done ? 'Review your curated selection below' : 'Claude is reviewing your photos — this may take a few minutes'}
          </p>
        </div>
        {done && <button onClick={onComplete} className="btn-primary mt-6">Download album →</button>}
      </div>

      <div ref={logRef} className="space-y-1.5 mb-8 max-h-64 overflow-y-auto">
        {log.map(entry => <LogLine key={entry.id} text={entry.text} status={entry.status} />)}
      </div>

      {error && (
        <div className="card p-4 border-red-900/50 mb-6">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={() => { setError(''); setLog([]); analysisRef.current = false; startAnalysis() }}
            className="btn-ghost mt-3 text-xs">Retry</button>
        </div>
      )}

      {done && curatedPhotos.length > 0 && (
        <div className="fade-up">
          <h3 className="font-display text-xl text-film-cream mb-4">{curatedPhotos.length} curated photos</h3>
          <div className="columns-3 gap-2 space-y-2 mb-8">
            {curatedPhotos.map(photo => (
              <div key={photo.id} className="break-inside-avoid rounded overflow-hidden" title={photo.curation_reason}>
                <img src={photo.cloudinary_url} alt="" className="w-full h-auto block" loading="lazy" />
              </div>
            ))}
          </div>
          <div className="text-center">
            <button onClick={onComplete} className="btn-primary px-8 py-3">Download album →</button>
            <p className="text-film-muted text-xs mt-2">Downloads as a zip with photos named in order</p>
          </div>
        </div>
      )}
    </div>
  )
}
