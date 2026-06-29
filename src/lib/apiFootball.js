async function apiRequest(endpoint) {
  const url = `/api/football?endpoint=${encodeURIComponent(endpoint)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export async function fetchFixtures() {
  const [all, finished] = await Promise.all([
    apiRequest('/competitions/WC/matches'),
    apiRequest('/competitions/WC/matches?status=FINISHED')
  ])
  const map = {}
  for (const m of all.matches || []) map[m.id] = m
  for (const m of finished.matches || []) map[m.id] = m
  return Object.values(map)
}

export async function fetchLiveFixtures() {
  const data = await apiRequest('/competitions/WC/matches?status=IN_PLAY,PAUSED')
  return data.matches || []
}

export function mapFixtureToMatch(match) {
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
  else if (['IN_PLAY', 'PAUSED'].includes(match.status)) status = 'live'
  let groupLabel = null
  if (stage === 'group') {
    const g = match.group || ''
    groupLabel = g.startsWith('GROUP_') ? 'Grupa ' + g.replace('GROUP_', '') : (g || null)
  }
  let winner = null
  if (stage !== 'group') {
    if (match.score?.winner === 'HOME_TEAM') winner = match.homeTeam?.name || null
    else if (match.score?.winner === 'AWAY_TEAM') winner = match.awayTeam?.name || null
  }
  return {
    api_match_id: match.id,
    home_team: match.homeTeam?.name || 'TBD',
    away_team: match.awayTeam?.name || 'TBD',
    home_flag: null, away_flag: null,
    home_score: match.score?.fullTime?.home ?? null,
    away_score: match.score?.fullTime?.away ?? null,
    kickoff_at: match.utcDate,
    stage, group_name: groupLabel, status,
    venue: match.venue || null,
    winner
  }
}
