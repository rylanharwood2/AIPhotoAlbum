# Triproll — AI Travel Photo Albums

Triproll uses Claude AI to automatically curate the best photos from your trips into beautiful albums. Sign in with Google, pick photos from Google Photos or upload from your computer, and Claude selects a diverse, high-quality set for you to download.

---

## Architecture

- **Frontend:** React + Vite + Tailwind CSS → hosted on **Vercel** (free)
- **Backend:** Node.js + Express → hosted on **Render** (free tier)
- **Database:** Supabase (Postgres) → stores users, trips, photo metadata
- **Photo storage:** Cloudinary → stores actual photo files
- **AI:** Anthropic Claude (your API key, stored server-side)
- **Auth:** Google OAuth (server-side, no secrets exposed to browser)

---

## Setup Guide

You'll need accounts on five services. All have free tiers.

### 1. Supabase (database)

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Once created, go to **SQL Editor → New Query**
3. Paste the entire contents of `backend/db/schema.sql` and click **Run**
4. Go to **Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role secret** → `SUPABASE_SERVICE_KEY` (use service_role, not anon)

### 2. Cloudinary (photo storage)

1. Go to [cloudinary.com](https://cloudinary.com) and create a free account
2. From the dashboard, copy:
   - **Cloud name** → `CLOUDINARY_CLOUD_NAME`
   - **API Key** → `CLOUDINARY_API_KEY`
   - **API Secret** → `CLOUDINARY_API_SECRET`

### 3. Google Cloud Console (OAuth + Photos API)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or use your existing one)
3. **Enable APIs:**
   - APIs & Services → Library → search "Photos Picker API" → Enable
   - APIs & Services → Library → search "People API" → Enable
4. **Create OAuth credentials:**
   - APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
   - Type: **Web application**
   - Authorised redirect URIs: add your Render backend URL + `/auth/callback`
     e.g. `https://triproll-backend.onrender.com/auth/callback`
   - Also add `http://localhost:3001/auth/callback` for local development
   - Copy **Client ID** → `GOOGLE_CLIENT_ID`
   - Copy **Client Secret** → `GOOGLE_CLIENT_SECRET`
5. **OAuth consent screen:**
   - Add your email as a test user
   - Add scopes: `openid`, `email`, `profile`, `photospicker.mediaitems.readonly`

### 4. Anthropic (AI)

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an API key → `ANTHROPIC_API_KEY`

### 5. Deploy the backend to Render

1. Push this entire project to a GitHub repository
2. Go to [render.com](https://render.com) and connect your GitHub account
3. New → **Web Service** → select your repo
4. Settings:
   - **Root directory:** `backend`
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Instance type:** Free
5. Add these **Environment Variables** (in Render dashboard → Environment):

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://your-render-url.onrender.com/auth/callback
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
ANTHROPIC_API_KEY=...
SESSION_SECRET=pick_a_long_random_string_at_least_32_characters
FRONTEND_URL=https://your-vercel-url.vercel.app
NODE_ENV=production
```

6. Deploy. Note your Render URL (e.g. `https://triproll-backend.onrender.com`)

### 6. Deploy the frontend to Vercel

1. Go to [vercel.com](https://vercel.com) and connect your GitHub account
2. New Project → import your repo
3. Settings:
   - **Root directory:** leave blank (or set to `/` — the frontend is at the root)
   - **Framework Preset:** Vite
4. Add these **Environment Variables** (in Vercel dashboard → Settings → Environment Variables):

```
VITE_API_URL=https://your-render-url.onrender.com
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

5. Deploy. Note your Vercel URL (e.g. `https://triproll.vercel.app`)
6. Go back to Google Cloud Console and add your Vercel URL as an **Authorised JavaScript origin** on your OAuth client

### 7. Final wiring

- In Render: update `FRONTEND_URL` to your actual Vercel URL
- In Google Cloud Console: make sure your Render `/auth/callback` URL is in the redirect URIs

---

## Local Development

### Backend

```bash
cd backend
cp .env.example .env
# Fill in all values in .env
npm install
npm run dev   # runs on http://localhost:3001
```

### Frontend

```bash
# In the project root
cp .env.example .env.local
# Set VITE_API_URL=http://localhost:3001
# Set VITE_GOOGLE_CLIENT_ID=your_client_id
npm install
npm run dev   # runs on http://localhost:5173
```

Make sure `http://localhost:3001/auth/callback` is added as a redirect URI in Google Cloud Console.

---

## Rate Limiting

- **$3/day** total Claude API spend across all users
- **200 requests per 15 minutes** per IP address (covers the whole backend)
- When the daily limit is hit, users see a friendly message and can try again tomorrow
- You can adjust `DAILY_CAP_USD` in `backend/middleware/rateLimit.js`

---

## Cost Estimate

A typical analysis of 30 photos costs roughly **$0.10–0.30** in Claude API usage depending on how many duplicate groups need reviewing. At the $3/day cap, that's roughly 10–30 analyses per day before the limit kicks in.

---

## Notes

- The Render free tier spins down after 15 minutes of inactivity. First sign-in after a period of no use may take 30–60 seconds while Render cold-starts the backend. This is normal.
- Google Photos Picker URLs expire after ~60 minutes. Photos are uploaded to Cloudinary immediately so they're permanently available after that.
- Cloudinary free tier: 25GB storage, 25GB bandwidth/month. A typical trip of 25 full-size photos is ~50–100MB.
