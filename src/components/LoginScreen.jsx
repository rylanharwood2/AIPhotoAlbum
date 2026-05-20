export default function LoginScreen({ onSignIn, error }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 fade-up">
      <div className="text-center max-w-sm">
        <h1 className="font-display text-5xl font-light text-film-cream tracking-wide mb-2">
          Triproll
        </h1>
        <p className="text-film-muted text-sm mb-10">
          AI-curated travel albums from your Google Photos
        </p>

        {error && (
          <div className="card p-3 border-red-900/50 mb-6 text-left">
            <p className="text-red-400 text-xs leading-relaxed">{error}</p>
          </div>
        )}

        <button onClick={onSignIn} className="btn-primary px-8 py-3 text-base">
          Sign in with Google
        </button>

        <p className="text-film-muted text-xs mt-4 leading-relaxed">
          We'll request access to your Google Photos to let you pick photos for your albums.
          Your photos are stored privately and only you can see them.
        </p>
      </div>
    </div>
  )
}
