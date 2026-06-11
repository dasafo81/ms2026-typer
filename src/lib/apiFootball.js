// football-data.org API — przez Vercel proxy (CORS fix)
async function apiRequest(endpoint) {
  const url = `/api/football?endpoint=${encodeURIComponent(endpoint)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export async function fetchFixtures() {
  // Pobierz wszystkie mecze + osobno zakończone (żeby mieć pewność wyników)
  const [all, finished] = await Promise.all([
    apiRequest('/competitions/WC/matches'),
    apiRequest('/competitions/WC/matches?status=FINISHED')
  ])

  const allMatches = all.matches || []
  const finishedMatches = finished.matches || []

  // Scal — zakończone nadpisują scheduled
  const map = {}
  for (const m of allMatches) map[m.id] = m
  for (const m of finishedMatches) map[m.id] = m

  return Object.values(map)
}

export async function fetchLiveFixtures() {
  const data = await apiRequest('/competitions/WC/matches?status=IN_PLAY,PAUSED')
  return data.matches || []
}

export function mapFixtureToMatch(match) {
  const round = match.stage || ''
  const groupName = match.group || match.stage || ''

  let stage = 'group'
  if (round === 'ROUND_OF_16') stage = 'r16'
  else if (round === 'QUARTER_FINALS') stage = 'qf'
  else if (round === 'SEMI_FINALS') stage = 'sf'
  else if (round === 'FINAL') stage = 'final'

  let status = 'scheduled'
  if (match.status === 'FINISHED') status = 'finished'
  else if (['IN_PLAY', 'PAUSED'].includes(match.status)) status = 'live'

  const homeScore = match.score?.fullTime?.home ?? null
  const awayScore = match.score?.fullTime?.away ?? null

  const groupLabel = groupName.startsWith('GROUP_')
    ? 'Grupa ' + groupName.replace('GROUP_', '')
    : groupName

  return {
    api_match_id: match.id,
    home_team: match.homeTeam?.name || 'TBD',
    away_team: match.awayTeam?.name || 'TBD',
    home_flag: null,
    away_flag: null,
    home_score: homeScore,
    away_score: awayScore,
    kickoff_at: match.utcDate,
    stage,
    group_name: groupLabel,
    status,
    venue: match.venue || null
  }
}
