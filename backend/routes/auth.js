const express = require('express')
const router = express.Router()
const axios = require('axios')
const { v4: uuidv4 } = require('uuid')
const supabase = require('../db/supabase')

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'

// Scopes: identity + Google Photos picker
const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/photospicker.mediaitems.readonly',
].join(' ')

// Session duration: 30 days
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000

// Step 1: Redirect user to Google
router.get('/google', (req, res) => {
  const state = uuidv4()
  // Store state in a short-lived cookie for CSRF protection
  res.cookie('oauth_state', state, { httpOnly: true, maxAge: 10 * 60 * 1000, sameSite: 'lax' })

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    state,
    access_type: 'offline',
    prompt: 'consent',
  })

  res.redirect(`${GOOGLE_AUTH_URL}?${params}`)
})

// Step 2: Google redirects back here with a code
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query

  if (error) {
    return res.redirect(`${process.env.FRONTEND_URL}?error=${encodeURIComponent(error)}`)
  }

  // Verify state matches to prevent CSRF
  if (state !== req.cookies?.oauth_state) {
    return res.redirect(`${process.env.FRONTEND_URL}?error=state_mismatch`)
  }
  res.clearCookie('oauth_state')

  try {
    // Exchange code for tokens
    const tokenRes = await axios.post(GOOGLE_TOKEN_URL, new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })

    const { access_token, refresh_token } = tokenRes.data

    // Get user info from Google
    const userRes = await axios.get(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${access_token}` },
    })

    const { id: googleId, email, name, picture } = userRes.data

    // Upsert user in Supabase
    const { data: user } = await supabase
      .from('users')
      .upsert(
        { google_id: googleId, email, name, avatar_url: picture },
        { onConflict: 'google_id', ignoreDuplicates: false }
      )
      .select()
      .single()

    // Store Google tokens against the user for Picker API calls
    await supabase
      .from('users')
      .update({ google_access_token: access_token, google_refresh_token: refresh_token })
      .eq('id', user.id)

    // Create a session token
    const sessionToken = uuidv4()
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString()

    await supabase.from('sessions').insert({
      user_id: user.id,
      token: sessionToken,
      expires_at: expiresAt,
    })

    // Set session cookie
    res.cookie('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_DURATION_MS,
    })

    res.redirect(process.env.FRONTEND_URL)
  } catch (err) {
    console.error('Auth callback error:', err.message)
    res.redirect(`${process.env.FRONTEND_URL}?error=auth_failed`)
  }
})

// Get current user
router.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' })
  res.json({
    id: req.user.id,
    email: req.user.email,
    name: req.user.name,
    avatarUrl: req.user.avatar_url,
  })
})

// Logout
router.post('/logout', async (req, res) => {
  const token = req.cookies?.session
  if (token) {
    await supabase.from('sessions').delete().eq('token', token)
    res.clearCookie('session')
  }
  res.json({ success: true })
})

module.exports = router

// Return the user's Google access token for use with the Photos Picker API
router.get('/google-token', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' })

  const { data: user } = await supabase
    .from('users')
    .select('google_access_token')
    .eq('id', req.user.id)
    .single()

  if (!user?.google_access_token) {
    return res.status(400).json({ error: 'No Google token found — please sign in again' })
  }

  res.json({ accessToken: user.google_access_token })
})
