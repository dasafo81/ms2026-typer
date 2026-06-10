const API_KEY = import.meta.env.VITE_API_FOOTBALL_KEY
const BASE_URL = 'https://v3.football.api-sports.io'

// MŚ 2026 — league_id: 1 (FIFA World Cup), season: 2026
const WC_LEAGUE_ID = 1
const WC_SEASON = 2026

async function apiRequest(endpoint) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      'x-apisports-key': API_KEY
    }
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export async function fetchFixtures() {
  const data = await apiRequest(`/fixtures?league=${WC_LEAGUE_ID}&season=${WC_SEASON}`)
  return data.response || []
}

export async function fetchLiveFixtures() {
  const data = await apiRequest(`/fixtures?league=${WC_LEAGUE_ID}&season=${WC_SEASON}&live=all`)
  return data.response || []
}

export async function fetchFixtureById(fixtureId) {
  const data = await apiRequest(`/fixtures?id=${fixtureId}`)
  return data.response?.[0] || null
}

export function mapFixtureToMatch(fixture) {
  const f = fixture.fixture
  const teams = fixture.teams
  const goals = fixture.goals
  const league = fixture.league

  let stage = 'group'
  const round = league.round?.toLowerCase() || ''
  if (round.includes('round of 16')) stage = 'r16'
  else if (round.includes('quarter')) stage = 'qf'
  else if (round.includes('semi')) stage = 'sf'
  else if (round.includes('final') && !round.includes('semi')) stage = 'final'

  let status = 'scheduled'
  if (f.status.short === 'FT' || f.status.short === 'AET' || f.status.short === 'PEN') {
    status = 'finished'
  } else if (['1H', '2H', 'HT', 'ET', 'P'].includes(f.status.short)) {
    status = 'live'
  }

  return {
    api_match_id: f.id,
    home_team: teams.home.name,
    away_team: teams.away.name,
    home_flag: null,
    away_flag: null,
    home_score: goals.home,
    away_score: goals.away,
    kickoff_at: f.date,
    stage,
    group_name: league.round,
    status,
    venue: f.venue?.name ? `${f.venue.name}, ${f.venue.city}` : null
  }
}
