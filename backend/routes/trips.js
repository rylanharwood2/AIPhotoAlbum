const express = require('express')
const router = express.Router()
const supabase = require('../db/supabase')
const { requireAuth } = require('../middleware/auth')
const { deleteTripPhotos } = require('../services/cloudinary')

// All trip routes require auth
router.use(requireAuth)

// List all trips for the current user
router.get('/', async (req, res) => {
  const { data: trips, error } = await supabase
    .from('trips')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  res.json(trips)
})

// Create a trip
router.post('/', async (req, res) => {
  const { name, startDate, endDate } = req.body

  if (!name?.trim()) return res.status(400).json({ error: 'Trip name is required' })

  const { data: trip, error } = await supabase
    .from('trips')
    .insert({
      user_id: req.user.id,
      name: name.trim(),
      start_date: startDate || null,
      end_date: endDate || null,
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(trip)
})

// Delete a trip and all its photos
router.delete('/:id', async (req, res) => {
  // Verify ownership
  const { data: trip } = await supabase
    .from('trips')
    .select('id')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single()

  if (!trip) return res.status(404).json({ error: 'Trip not found' })

  // Delete photos from Cloudinary
  try {
    await deleteTripPhotos(req.params.id)
  } catch (err) {
    // Don't fail if Cloudinary deletion fails — folder may not exist yet
    console.warn('Cloudinary deletion warning:', err.message)
  }

  // Delete from Supabase (cascades to photos)
  const { error } = await supabase
    .from('trips')
    .delete()
    .eq('id', req.params.id)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

module.exports = router
