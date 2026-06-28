// Zwraca true jeśli turniej jest w fazie pucharowej
// Sprawdza czy istnieją mecze non-group które są live lub finished,
// lub czy następny mecz jest non-group
export function isKnockoutPhase(matches) {
  if (!matches || matches.length === 0) return false
  const knockout = matches.filter(m => m.stage !== 'group')
  if (knockout.length === 0) return false
  // Jeśli jakiś mecz pucharowy jest live lub finished — faza pucharowa aktywna
  const active = knockout.some(m => m.status === 'live' || m.status === 'finished')
  if (active) return true
  // Jeśli następny mecz (scheduled) jest pucharowy
  const now = new Date()
  const next = matches
    .filter(m => m.status === 'scheduled' && new Date(m.kickoff_at) > now)
    .sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at))[0]
  return next ? next.stage !== 'group' : false
}

export const THEME = {
  group: {
    bg: '#f7f4ef',
    bg2: '#ffffff',
    bg3: '#f0ece3',
    bg4: '#e8e2d6',
    border: '#e8e0d0',
    border2: '#b8952a40',
    text: '#1a1208',
    text2: '#5a4a2a',
    text3: '#9a8a6a',
    accent: '#b8952a',
    accent2: '#c9a84c',
    accent3: '#f5d87a',
    headerBg: '#0d0d0d',
    headerBorder: '#b8952a',
  },
  knockout: {
    bg: '#0f0e17',
    bg2: '#1a1825',
    bg3: '#13121e',
    bg4: '#1f1d2e',
    border: '#e2c96e22',
    border2: '#e2c96e44',
    text: '#f0ede0',
    text2: '#a09880',
    text3: '#4a4560',
    accent: '#e2c96e',
    accent2: '#c9a84c',
    accent3: '#f5d87a',
    headerBg: '#0a0910',
    headerBorder: '#e2c96e',
  }
}
