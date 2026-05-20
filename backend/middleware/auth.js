const supabase = require('../db/supabase')

// Attaches req.user if a valid session cookie is present
// Pass requireAuth=true to return 401 if not logged in
async function authMiddleware(req, res, next) {
  const token = req.cookies?.session

  if (!token) {
    req.user = null
    return next()
  }

  const { data: session } = await supabase
    .from('sessions')
    .select('*, users(*)')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (!session) {
    // Clear the stale cookie
    res.clearCookie('session')
    req.user = null
    return next()
  }

  req.user = session.users
  next()
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' })
  next()
}

module.exports = { authMiddleware, requireAuth }
