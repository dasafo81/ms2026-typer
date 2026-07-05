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

  // Zwycięzca pucharu z API — działa też dla karnych (score.winner = drużyna, która przeszła)
  let winner = null
  if (stage !== 'group') {
    if (match.score?.winner === 'HOME_TEAM') winner = match.homeTeam?.name || null
    else if (match.score?.winner === 'AWAY_TEAM') winner = match.awayTeam?.name || null
  }

  // ===== Wyniki: 90' jako główny score (na nim liczą się punkty),
  // dogrywka i karne osobno =====
  const s = match.score || {}
  const duration = s.duration || 'REGULAR' // REGULAR / EXTRA_TIME / PENALTY_SHOOTOUT
  const reg = s.regularTime
  const ext = s.extraTime
  const pen = s.penalties
  const ft = s.fullTime

  // Wynik po 90 minutach
  let homeScore, awayScore, scoreKnown = true
  if (reg && (reg.home !== null || reg.away !== null)) {
    homeScore = reg.home; awayScore = reg.away
  } else if (duration === 'REGULAR') {
    homeScore = ft?.home ?? null; awayScore = ft?.away ?? null
  } else {
    // Mecz z dogrywką/karnymi bez regularTime z API — NIE nadpisujemy
    // wyniku w bazie (pomijamy pola), admin ma kontrolę nad tym wynikiem
    scoreKnown = false
  }

  // Wynik po dogrywce (suma 90' + gole w dogrywce)
  let etHome = null, etAway = null
  if (duration !== 'REGULAR') {
    if (reg && ext && ext.home !== null) {
      etHome = (reg.home ?? 0) + (ext.home ?? 0)
      etAway = (reg.away ?? 0) + (ext.away ?? 0)
    } else if (duration === 'EXTRA_TIME' && ft) {
      etHome = ft.home; etAway = ft.away
    }
  }

  // Karne
  const penHome = duration === 'PENALTY_SHOOTOUT' ? (pen?.home ?? null) : null
  const penAway = duration === 'PENALTY_SHOOTOUT' ? (pen?.away ?? null) : null

  const payload = {
    api_match_id: match.id,
    home_team: match.homeTeam?.name || 'TBD',
    away_team: match.awayTeam?.name || 'TBD',
    kickoff_at: match.utcDate,
    stage,
    group_name: groupLabel,
    status,
    venue: match.venue || null,
    winner,
    went_to_penalties: duration === 'PENALTY_SHOOTOUT',
    extra_time: duration !== 'REGULAR'
  }
  // Pola wyniku tylko gdy znamy wynik 90' — inaczej nie ruszamy istniejących wartości
  if (scoreKnown) {
    payload.home_score = homeScore
    payload.away_score = awayScore
  }
  if (etHome !== null) { payload.score_et_home = etHome; payload.score_et_away = etAway }
  if (penHome !== null) { payload.score_pen_home = penHome; payload.score_pen_away = penAway }
  return payload
}

export default async function handler(req, res) {
  // Zabezpieczenie — tylko Vercel Cron może wywołać ten endpoint
  const authHeader = req.headers['authorization']
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const matches = await fetchMatches()

    // Mecze z ręczną korektą wyniku — sync NIE dotyka ich pól wynikowych
    const { data: manualRows } = await supabase
      .from('matches')
      .select('api_match_id')
      .eq('manual_result', true)
    const manualIds = new Set((manualRows || []).map(m => m.api_match_id))

    let updated = 0
    const finishedIds = []

    for (const match of matches) {
      const mapped = mapMatch(match)

      // Ręcznie skorygowany mecz: usuwamy z payloadu wszystkie pola wynikowe
      if (manualIds.has(match.id)) {
        delete mapped.home_score
        delete mapped.away_score
        delete mapped.score_et_home
        delete mapped.score_et_away
        delete mapped.score_pen_home
        delete mapped.score_pen_away
        delete mapped.winner
        delete mapped.went_to_penalties
        delete mapped.extra_time
        delete mapped.status
      }

      const { error } = await supabase
        .from('matches')
        .upsert(mapped, { onConflict: 'api_match_id' })

      if (!error) {
        updated++
        // Punkty przeliczamy tylko meczom bez ręcznej korekty
        if (mapped.status === 'finished' && !manualIds.has(match.id)) finishedIds.push(mapped.api_match_id)
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
