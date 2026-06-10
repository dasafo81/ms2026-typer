// football-data.org API
// MŚ 2026 — competition code: WC
const API_KEY = import.meta.env.VITE_FOOTBALL_DATA_KEY
const BASE_URL = 'https://api.football-data.org/v4'

async function apiRequest(endpoint) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      'X-Auth-Token': API_KEY
    }
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export async function fetchFixtures() {
  const data = await apiRequest('/competitions/WC/matches')
  return data.matches || []
}

export async function fetchLiveFixtures() {
  const data = await apiRequest('/competitions/WC/matches?status=LIVE,IN_PLAY,PAUSED')
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
  else if (['IN_PLAY', 'PAUSED', 'LIVE'].includes(match.status)) status = 'live'

  const homeScore = match.score?.fullTime?.home ?? null
  const awayScore = match.score?.fullTime?.away ?? null

  // Mapowanie fazy grupowej na czytelną nazwę
  const groupLabel = groupName.replace('GROUP_', 'Grupa ')

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
