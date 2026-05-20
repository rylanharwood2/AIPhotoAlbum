const supabase = require('../db/supabase')

const DAILY_CAP_USD = 3.00

// Check if we're under the daily spend cap
// Returns true if the request can proceed, false if capped
async function checkRateLimit() {
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

  const { data } = await supabase
    .from('rate_limits')
    .select('total_cost_usd')
    .eq('date', today)
    .single()

  const spent = data?.total_cost_usd || 0
  return spent < DAILY_CAP_USD
}

// Add to today's spend after a Claude API call completes
// cost is in USD (e.g. 0.04 for a 4 cent call)
async function recordSpend(costUsd) {
  const today = new Date().toISOString().split('T')[0]

  // Upsert: insert today's row if it doesn't exist, otherwise add to it
  const { data: existing } = await supabase
    .from('rate_limits')
    .select('total_cost_usd')
    .eq('date', today)
    .single()

  const newTotal = (existing?.total_cost_usd || 0) + costUsd

  await supabase
    .from('rate_limits')
    .upsert({ date: today, total_cost_usd: newTotal, updated_at: new Date().toISOString() })
}

// Rough cost estimator based on Claude's token pricing
// claude-opus-4-5: $15/M input tokens, $75/M output tokens
// Images count as ~1600 tokens each at full size
function estimateCost(inputTokens, outputTokens) {
  return (inputTokens / 1_000_000) * 15 + (outputTokens / 1_000_000) * 75
}

module.exports = { checkRateLimit, recordSpend, estimateCost }
