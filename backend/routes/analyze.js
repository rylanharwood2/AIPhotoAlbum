const express = require('express')
const router = express.Router()
const JSZip = require('jszip')
const axios = require('axios')
const supabase = require('../db/supabase')
const { requireAuth } = require('../middleware/auth')
const { checkRateLimit } = require('../middleware/rateLimit')
const { groupCandidateDuplicates, analyzeGroup, curateSelection } = require('../services/claude')

// For EventSource routes, token may come as query param instead of header
router.use(async (req, res, next) => {
  if (req.query.token && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${req.query.token}`
  }
  next()
})

router.use(requireAuth)

// Get saved analysis for a trip
router.get('/:tripId', async (req, res) => {
  const { data: trip } = await supabase
    .from('trips')
    .select('id')
    .eq('id', req.params.tripId)
    .eq('user_id', req.user.id)
    .single()

  if (!trip) return res.status(404).json({ error: 'Trip not found' })

  const { data: curatedPhotos } = await supabase
    .from('photos')
    .select('*')
    .eq('trip_id', req.params.tripId)
    .eq('is_curated', true)
    .order('curation_order', { ascending: true })

  res.json({ curatedPhotos: curatedPhotos || [] })
})

// Run Claude analysis on a trip's photos
// Returns SSE stream so the frontend can show live progress
router.post('/:tripId/run', async (req, res) => {
  const { tripId } = req.params

  const { data: trip } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .eq('user_id', req.user.id)
    .single()

  if (!trip) return res.status(404).json({ error: 'Trip not found' })

  const canProceed = await checkRateLimit()
  if (!canProceed) {
    return res.status(429).json({
      error: "Today's analysis limit has been reached. Please try again tomorrow.",
    })
  }

  // Set up SSE so frontend gets live progress updates
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const send = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`)
  }

  try {
    // Load all photos for this trip
    const { data: photos } = await supabase
      .from('photos')
      .select('*')
      .eq('trip_id', tripId)
      .order('taken_at', { ascending: true, nullsFirst: false })

    if (!photos || photos.length === 0) {
      send('error', { message: 'No photos found for this trip' })
      return res.end()
    }

    // Clear any previous curation
    await supabase
      .from('photos')
      .update({ is_curated: false, curation_reason: null, curation_order: null })
      .eq('trip_id', tripId)

    send('log', { message: `Analyzing ${photos.length} photos…` })

    // Phase 1: Group candidate duplicates
    const photosMapped = photos.map(p => ({
      id: p.id,
      cloudinaryUrl: p.cloudinary_url,
      filename: p.filename,
      takenAt: p.taken_at,
    }))

    send('log', { message: 'Grouping photos by timestamp…' })
    const groups = groupCandidateDuplicates(photosMapped)
    const burstGroups = groups.filter(g => g.length > 1)
    send('log', { message: `Found ${groups.length} scenes — ${burstGroups.length} possible burst sets` })

    // Phase 2: Confirm true duplicates
    const uniquePhotos = []
    const humanComparisons = []

    for (const group of groups) {
      if (group.length === 1) {
        uniquePhotos.push(group[0])
        continue
      }

      const result = await analyzeGroup(group)

      if (!result.isTrueDuplicate) {
        uniquePhotos.push(...group)
      } else if (result.needsHuman) {
        // Surface to frontend for human comparison
        const photoA = group.find(p => p.id === result.winnerId) || group[0]
        const photoB = group.find(p => p.id !== photoA.id) || group[1]

        send('comparison', {
          groupId: group.map(p => p.id).join(','),
          photoA: { id: photoA.id, url: photoA.cloudinaryUrl },
          photoB: { id: photoB.id, url: photoB.cloudinaryUrl },
        })

        humanComparisons.push({ group, photoA, photoB })
        // Winner will come back via the /pick endpoint
        // For now add both and let user sort it out — we handle this below
        uniquePhotos.push(group[0])
      } else {
        uniquePhotos.push(group.find(p => p.id === result.winnerId) || group[0])
      }
    }

    send('log', { message: `Duplicate check done — ${uniquePhotos.length} unique shots identified` })

    // Phase 3: Curate diverse selection
    send('log', { message: `Selecting the best photos from ${uniquePhotos.length} unique shots…` })
    const curated = await curateSelection(uniquePhotos, trip.name)
    send('log', { message: `Done — ${curated.length} photos selected` })

    // Save curation results to Supabase
    for (const item of curated) {
      await supabase
        .from('photos')
        .update({
          is_curated: true,
          curation_reason: item.reason,
          curation_order: item.order,
        })
        .eq('id', item.id)
    }

    // Return the curated photos
    const { data: curatedPhotos } = await supabase
      .from('photos')
      .select('*')
      .eq('trip_id', tripId)
      .eq('is_curated', true)
      .order('curation_order', { ascending: true })

    send('done', { curatedPhotos })
    res.end()

  } catch (err) {
    console.error('Analysis error:', err)
    if (err.message === 'RATE_LIMIT_EXCEEDED') {
      send('error', { message: "Today's analysis limit has been reached. Please try again tomorrow." })
    } else {
      send('error', { message: err.message || 'Analysis failed' })
    }
    res.end()
  }
})

// Download curated photos as a zip
router.get('/:tripId/download', async (req, res) => {
  const { data: trip } = await supabase
    .from('trips')
    .select('*')
    .eq('id', req.params.tripId)
    .eq('user_id', req.user.id)
    .single()

  if (!trip) return res.status(404).json({ error: 'Trip not found' })

  const { data: photos } = await supabase
    .from('photos')
    .select('*')
    .eq('trip_id', req.params.tripId)
    .eq('is_curated', true)
    .order('curation_order', { ascending: true })

  if (!photos || photos.length === 0) {
    return res.status(404).json({ error: 'No curated photos found' })
  }

  const zip = new JSZip()
  const folder = zip.folder(trip.name)

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i]
    const num = String(i + 1).padStart(2, '0')
    const ext = photo.filename.includes('.')
      ? photo.filename.split('.').pop().toLowerCase()
      : 'jpg'

    try {
      const imageRes = await axios.get(photo.cloudinary_url, { responseType: 'arraybuffer' })
      folder.file(`${num}.${ext}`, imageRes.data)
    } catch (err) {
      console.warn(`Skipping ${photo.filename}:`, err.message)
    }
  }

  const blob = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' })

  const safeName = trip.name.replace(/[^a-z0-9]/gi, '_')
  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}.zip"`)
  res.send(blob)
})

module.exports = router
