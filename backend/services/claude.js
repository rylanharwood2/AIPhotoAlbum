const Anthropic = require('@anthropic-ai/sdk')
const { checkRateLimit, recordSpend, estimateCost } = require('../middleware/rateLimit')

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = 'claude-opus-4-5'

function parseJSON(text) {
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(cleaned)
}

// Group photos taken within 3 seconds of each other as duplicate candidates
function groupCandidateDuplicates(photos) {
  if (photos.length === 0) return []

  const sorted = [...photos].sort((a, b) => new Date(a.takenAt) - new Date(b.takenAt))
  const groups = []
  let current = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const diff = (new Date(sorted[i].takenAt) - new Date(sorted[i - 1].takenAt)) / 1000
    if (diff <= 3) {
      current.push(sorted[i])
    } else {
      groups.push(current)
      current = [sorted[i]]
    }
  }
  groups.push(current)

  // If a group is larger than 4, it's almost certainly a filesystem timestamp
  // artifact (all files copied at once), not a real burst. Split them out.
  return groups.flatMap(g => g.length > 4 ? g.map(p => [p]) : [g])
}

// Ask Claude if a group of photos are truly the same shot
// Returns { isTrueDuplicate, winnerId, confidence, needsHuman }
async function analyzeGroup(group) {
  if (group.length === 1) {
    return { isTrueDuplicate: false, winnerId: group[0].id, confidence: 100, needsHuman: false }
  }

  const canProceed = await checkRateLimit()
  if (!canProceed) throw new Error('RATE_LIMIT_EXCEEDED')

  const imageContent = group.slice(0, 4).flatMap(photo => [
    { type: 'image', source: { type: 'url', url: photo.cloudinaryUrl } },
    { type: 'text', text: `Photo ID: ${photo.id}` },
  ])

  const prompt = `You are reviewing ${group.length} photos taken within 3 seconds of each other.

Are these the same shot (same subject, same framing, slightly different moment) or different photos?

If the same shot, pick the best based on: sharpness, exposure, subject clarity (no closed eyes, no motion blur on faces).

Return ONLY valid JSON:
{
  "isTrueDuplicate": true,
  "winnerId": "id of best photo, or first photo id if not duplicate",
  "confidence": 85,
  "needsHuman": false,
  "reasoning": "one sentence"
}

Set needsHuman true only if truly identical but you cannot pick a winner (confidence below 60).
Set isTrueDuplicate false if these are genuinely different photos.`

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 256,
    messages: [{ role: 'user', content: [...imageContent, { type: 'text', text: prompt }] }],
  })

  const cost = estimateCost(response.usage.input_tokens, response.usage.output_tokens)
  await recordSpend(cost)

  try {
    return parseJSON(response.content[0].text)
  } catch {
    return { isTrueDuplicate: false, winnerId: group[0].id, confidence: 50, needsHuman: false }
  }
}

// Curate a diverse final selection from unique photos
// Priority: uniqueness and quality over hitting a number
// Returns array of { id, reason, order }
async function curateSelection(photos, tripName) {
  if (photos.length === 0) return []

  const canProceed = await checkRateLimit()
  if (!canProceed) throw new Error('RATE_LIMIT_EXCEEDED')

  const BATCH = 20

  if (photos.length <= BATCH) {
    return await curateBatch(photos, tripName)
  }

  // Multi-pass for larger sets
  const chunks = []
  for (let i = 0; i < photos.length; i += BATCH) {
    chunks.push(photos.slice(i, i + BATCH))
  }

  const perChunk = Math.ceil(25 / chunks.length) + 3
  let candidates = []
  for (const chunk of chunks) {
    const picked = await curateBatch(chunk, tripName, perChunk)
    candidates.push(...picked)
  }

  if (candidates.length <= 25) return candidates

  // Final pass to trim
  const candidatePhotos = candidates
    .map(c => photos.find(p => p.id === c.id))
    .filter(Boolean)
  return await curateBatch(candidatePhotos, tripName, 25)
}

async function curateBatch(photos, tripName, maxCount = 25) {
  const imageContent = photos.flatMap((photo, i) => [
    { type: 'image', source: { type: 'url', url: photo.cloudinaryUrl } },
    {
      type: 'text',
      text: `Photo ID: ${photo.id}, filename: ${photo.filename}, taken: ${photo.takenAt ? new Date(photo.takenAt).toLocaleString() : 'unknown'}`,
    },
  ])

  const prompt = `You are curating a travel photo album called "${tripName}".

Your goal is a DIVERSE, HIGH QUALITY selection that tells the story of this trip.

RULES:
1. Prioritize uniqueness — prefer photos of clearly different subjects, locations, moments, or times of day
2. Only include near-similar photos if they are both genuinely excellent AND you cannot determine which is better. In that case include at most 2 and mark them as similar in the reason field so the user can choose
3. Do NOT pad the selection to hit a number. Return fewer, better photos rather than more mediocre ones
4. Hard cap: never return more than ${maxCount} photos
5. Prefer technically excellent photos (sharp focus, good exposure, interesting composition)
6. Spread selections across the full duration of the trip

Return ONLY a valid JSON array:
[
  { "id": "photo_id", "reason": "brief reason — if similar to another included photo note: SIMILAR TO photo_id" },
  ...
]

Be ruthless about quality and uniqueness. It is better to return 8 great photos than 20 mediocre ones.`

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [{ role: 'user', content: [...imageContent, { type: 'text', text: prompt }] }],
  })

  const cost = estimateCost(response.usage.input_tokens, response.usage.output_tokens)
  await recordSpend(cost)

  try {
    const parsed = parseJSON(response.content[0].text)
    return parsed
      .map((item, index) => ({ ...item, order: index }))
      .filter(item => photos.find(p => p.id === item.id))
  } catch {
    // Fallback: evenly sample
    const step = Math.max(1, Math.floor(photos.length / Math.min(maxCount, photos.length)))
    return photos
      .filter((_, i) => i % step === 0)
      .slice(0, maxCount)
      .map((p, i) => ({ id: p.id, reason: 'Evenly sampled (analysis fallback)', order: i }))
  }
}

module.exports = { groupCandidateDuplicates, analyzeGroup, curateSelection }
