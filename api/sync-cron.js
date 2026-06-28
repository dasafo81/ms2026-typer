import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

async function fetchMatches() {
  const res = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
    headers: { 'X-Auth-Token': process.env.VITE_FOOTBALL_DATA_KEY }
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  const data = await res.json()
  return data.matches || []
}

function mapMatch(match) {
  const round = match.stage || ''

  let stage = 'group'
  if (round === 'LAST_32' || round === 'ROUND_OF_32') stage = 'r32'
  else if (round === 'LAST_16' || round === 'ROUND_OF_16') stage = 'r16'
  else if (round === 'QUARTER_FINALS') stage = 'qf'
  else if (round === 'SEMI_FINALS') stage = 'sf'
  else if (round === 'THIRD_PLACE' || round === 'THIRD_PLACE_FINAL') stage = 'third'
  else if (round === 'FINAL') stage = 'final'

  let status = 'scheduled'
  if (match.status === 'FINISHED') status = 'finished'
  else if (['IN_PLAY', 'PAUSED', 'LIVE'].includes(match.status)) status = 'live'

  // Tylko faza grupowa ma sensowny group_name; dla pucharu zostawiamy null,
  // żeby etykietę wyznaczał stage (nigdy surowe 'LAST_32' z API).
  let groupLabel = null
  if (stage === 'group') {
    const g = match.group || ''
    groupLabel = g.startsWith('GROUP_') ? 'Grupa ' + g.replace('GROUP_', '') : (g || null)
  }

  return {
    api_match_id: match.id,
    home_team: match.homeTeam?.name || 'TBD',
    away_team: match.awayTeam?.name || 'TBD',
    home_score: match.score?.fullTime?.home ?? null,
    away_score: match.score?.fullTime?.away ?? null,
    kickoff_at: match.utcDate,
    stage,
    group_name: groupLabel,
    status,
    venue: match.venue || null
  }
}

export default async function handler(req, res) {
  // Zabezpieczenie — tylko Vercel Cron może wywołać ten endpoint
  const authHeader = req.headers['authorization']
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const matches = await fetchMatches()
    let updated = 0
    const finishedIds = []

    for (const match of matches) {
      const mapped = mapMatch(match)
      const { error } = await supabase
        .from('matches')
        .upsert(mapped, { onConflict: 'api_match_id' })

      if (!error) {
        updated++
        if (mapped.status === 'finished') finishedIds.push(mapped.api_match_id)
      }
    }

    // Przelicz punkty dla zakończonych meczów
    for (const apiId of finishedIds) {
      const { data: m } = await supabase
        .from('matches')
        .select('id')
        .eq('api_match_id', apiId)
        .single()
      if (m) {
        await supabase.rpc('calculate_points', { p_match_id: m.id })
      }
    }

    await supabase.from('sync_log').insert({
      matches_updated: updated,
      notes: `Auto cron — ${new Date().toISOString()}`
    })

    return res.status(200).json({ ok: true, updated })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
