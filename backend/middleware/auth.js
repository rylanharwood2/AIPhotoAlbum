const supabase = require('../db/supabase')

// Reads session token from either:
// 1. Authorization header (Bearer token) — used in production cross-domain
// 2. Cookie — used as fallback for same-domain setups
async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query?.token || req.cookies?.session

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
