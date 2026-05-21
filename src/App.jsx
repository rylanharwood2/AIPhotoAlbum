import { useState, useEffect, useRef } from 'react'
import { getMe, getTrips, getLoginUrl, saveToken, clearToken, getAnalysis, deletePhotos } from './utils/api.js'

import LoginScreen from './components/LoginScreen.jsx'
import TripsScreen from './components/TripsScreen.jsx'
import PhotosScreen from './components/PhotosScreen.jsx'
import AnalysisScreen from './components/AnalysisScreen.jsx'
import AlbumScreen from './components/AlbumScreen.jsx'

export default function App() {
  const [screen, setScreen] = useState('loading')
  const [user, setUser] = useState(null)
  const [trips, setTrips] = useState([])
  const [activeTrip, setActiveTrip] = useState(null)
  const [authError, setAuthError] = useState('')
  const initRan = useRef(false)

  useEffect(() => {
    if (initRan.current) return
    initRan.current = true

    const params = new URLSearchParams(window.location.search)

    // After Google login, the backend redirects here with ?token=...
    // Save it to localStorage so all future requests can send it as a header
    if (params.has('token')) {
      saveToken(params.get('token'))
      window.history.replaceState({}, document.title, window.location.pathname)
    }

    if (params.has('error')) {
      setAuthError('Sign-in failed: ' + params.get('error') + '. Please try again.')
      window.history.replaceState({}, document.title, window.location.pathname)
    }

    init()
  }, [])

  const init = async () => {
    try {
      const me = await getMe()
      setUser(me)
      const userTrips = await getTrips()
      setTrips(userTrips)
      setScreen('trips')
    } catch (err) {
      if (err.message === 'NOT_AUTHENTICATED') {
        setScreen('login')
      } else {
        setAuthError('Something went wrong loading your account.')
        setScreen('login')
      }
    }
  }

  const handleSignIn = () => {
    window.location.href = getLoginUrl()
  }

  const handleSignOut = async () => {
    clearToken()
    await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    })
    setUser(null)
    setTrips([])
    setActiveTrip(null)
    setScreen('login')
  }

  const refreshTrips = async () => {
    try {
      const userTrips = await getTrips()
      setTrips(userTrips)
    } catch {}
  }

  const handleSelectTrip = async (trip) => {
    setActiveTrip(trip)
    try {
      const { curatedPhotos } = await getAnalysis(trip.id)
      if (curatedPhotos && curatedPhotos.length > 0) {
        setScreen('album')
        return
      }
    } catch {}
    setScreen('photos')
  }

  const handleReupload = async () => {
    if (activeTrip) {
      await deletePhotos(activeTrip.id)
    }
    setScreen('photos')
  }

  if (screen === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="pulse-amber text-film-amber font-mono text-sm">Loading…</span>
      </div>
    )
  }

  if (screen === 'login') {
    return <LoginScreen onSignIn={handleSignIn} error={authError} />
  }

  if (screen === 'trips') {
    return (
      <TripsScreen
        trips={trips}
        user={user}
        onSelectTrip={handleSelectTrip}
        onTripsChange={refreshTrips}
        onSignOut={handleSignOut}
      />
    )
  }

  if (screen === 'photos' && activeTrip) {
    return (
      <PhotosScreen
        trip={activeTrip}
        onBack={() => { setScreen('trips'); refreshTrips() }}
        onStartAnalysis={() => setScreen('analysis')}
        onViewAlbum={() => setScreen('album')}
      />
    )
  }

  if (screen === 'analysis' && activeTrip) {
    return (
      <AnalysisScreen
        trip={activeTrip}
        onComplete={() => setScreen('album')}
        onBack={() => setScreen('photos')}
      />
    )
  }

  if (screen === 'album' && activeTrip) {
    return (
      <AlbumScreen
        trip={activeTrip}
        onBack={() => setScreen('analysis')}
        onDone={refreshTrips}
        onReupload={handleReupload}
      />
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <button onClick={() => setScreen('trips')} className="btn-ghost">Return home</button>
    </div>
  )
}
