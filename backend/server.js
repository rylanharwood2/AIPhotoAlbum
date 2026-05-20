require('dotenv').config()
const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const rateLimit = require('express-rate-limit')

const { authMiddleware } = require('./middleware/auth')
const authRoutes = require('./routes/auth')
const tripsRoutes = require('./routes/trips')
const photosRoutes = require('./routes/photos')
const analyzeRoutes = require('./routes/analyze')

const app = express()
const PORT = process.env.PORT || 3001

// Basic abuse protection — limit requests per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { error: 'Too many requests, please try again later' },
})
app.use(limiter)

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true, // needed for cookies to work cross-origin
}))

app.use(express.json({ limit: '50mb' }))
app.use(cookieParser())

// Attach user to every request if session cookie is present
app.use(authMiddleware)

// Routes
app.use('/auth', authRoutes)
app.use('/trips', tripsRoutes)
app.use('/photos', photosRoutes)
app.use('/analyze', analyzeRoutes)

app.get('/health', (req, res) => res.json({ ok: true }))

app.listen(PORT, () => {
  console.log(`Triproll backend running on port ${PORT}`)
})
