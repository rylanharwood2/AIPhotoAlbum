const express = require('express')
const router = express.Router()
const multer = require('multer')
const supabase = require('../db/supabase')
const { requireAuth } = require('../middleware/auth')
const { uploadPhoto, uploadFromUrl } = require('../services/cloudinary')

// Store uploads in memory (we immediately forward to Cloudinary)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB per file
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'))
    }
    cb(null, true)
  },
})

router.use(requireAuth)

// Get all photos for a trip
router.get('/:tripId', async (req, res) => {
  // Verify trip ownership
  const { data: trip } = await supabase
    .from('trips')
    .select('id')
    .eq('id', req.params.tripId)
    .eq('user_id', req.user.id)
    .single()

  if (!trip) return res.status(404).json({ error: 'Trip not found' })

  const { data: photos, error } = await supabase
    .from('photos')
    .select('*')
    .eq('trip_id', req.params.tripId)
    .order('taken_at', { ascending: true, nullsFirst: false })

  if (error) return res.status(500).json({ error: error.message })
  res.json(photos)
})

// Upload photos from disk (multipart form upload)
router.post('/:tripId/upload', upload.array('photos', 200), async (req, res) => {
  const { tripId } = req.params

  const { data: trip } = await supabase
    .from('trips')
    .select('id')
    .eq('id', tripId)
    .eq('user_id', req.user.id)
    .single()

  if (!trip) return res.status(404).json({ error: 'Trip not found' })

  const files = req.files || []
  if (files.length === 0) return res.status(400).json({ error: 'No files provided' })

  const results = []
  const errors = []

  for (const file of files) {
    try {
      const { url, publicId } = await uploadPhoto(file.buffer, file.originalname, tripId)

      const takenAt = req.body[`timestamp_${file.originalname}`] || null

      const { data: photo } = await supabase
        .from('photos')
        .insert({
          trip_id: tripId,
          cloudinary_url: url,
          cloudinary_public_id: publicId,
          filename: file.originalname,
          taken_at: takenAt,
        })
        .select()
        .single()

      results.push(photo)
    } catch (err) {
      errors.push({ filename: file.originalname, error: err.message })
    }
  }

  res.json({ uploaded: results, errors })
})

// Import photos from Google Photos Picker (array of { url, filename, takenAt })
router.post('/:tripId/import', async (req, res) => {
  const { tripId } = req.params
  const { photos: pickerPhotos } = req.body

  const { data: trip } = await supabase
    .from('trips')
    .select('id')
    .eq('id', tripId)
    .eq('user_id', req.user.id)
    .single()

  if (!trip) return res.status(404).json({ error: 'Trip not found' })
  if (!Array.isArray(pickerPhotos) || pickerPhotos.length === 0) {
    return res.status(400).json({ error: 'No photos provided' })
  }

  const results = []
  const errors = []

  for (const p of pickerPhotos) {
    try {
      const { url, publicId } = await uploadFromUrl(p.url, p.filename, tripId)

      const { data: photo } = await supabase
        .from('photos')
        .insert({
          trip_id: tripId,
          cloudinary_url: url,
          cloudinary_public_id: publicId,
          filename: p.filename,
          taken_at: p.takenAt || null,
        })
        .select()
        .single()

      results.push(photo)
    } catch (err) {
      errors.push({ filename: p.filename, error: err.message })
    }
  }

  res.json({ imported: results, errors })
})

// Delete all photos for a trip (to re-upload)
router.delete('/:tripId', async (req, res) => {
  const { data: trip } = await supabase
    .from('trips')
    .select('id')
    .eq('id', req.params.tripId)
    .eq('user_id', req.user.id)
    .single()

  if (!trip) return res.status(404).json({ error: 'Trip not found' })

  await supabase.from('photos').delete().eq('trip_id', req.params.tripId)

  try {
    const { deleteTripPhotos } = require('../services/cloudinary')
    await deleteTripPhotos(req.params.tripId)
  } catch (err) {
    console.warn('Cloudinary cleanup warning:', err.message)
  }

  res.json({ success: true })
})

module.exports = router
