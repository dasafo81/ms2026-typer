export function isKnockoutPhase(matches) {
  if (!matches || matches.length === 0) return false
  return matches.some(m => m.stage && m.stage !== 'group' && m.stage !== 'GROUP_STAGE')
}

export function currentKnockoutStage(matches) {
  if (!matches || matches.length === 0) return null
  const ORDER = ['r32', 'r16', 'qf', 'sf', 'final']
  // Najnowsza runda z prawdziwymi drużynami = aktualna
  // Bo drużyny pojawiają się w kolejnej rundzie dopiero po zakończeniu poprzedniej
  let current = null
  for (const s of ORDER) {
    const real = matches.filter(m => m.stage === s && m.home_team && m.home_team !== 'TBD')
    if (real.length > 0) current = s
  }
  return current
}

export const STAGE_PROGRESS = {
  r32:   { label: '1/16 finału', short: '1/16', icon: '⚔️' },
  r16:   { label: '1/8 finału',  short: '1/8',  icon: '🗡️' },
  qf:    { label: '1/4 finału',  short: '1/4',  icon: '🔥' },
  sf:    { label: '1/2 finału',  short: '1/2',  icon: '⚡' },
  final: { label: 'Finał',       short: 'Finał', icon: '🏆' },
}

export const THEME = {
  group: {
    bg: '#eef6ff', bg2: '#eef6ff', bg3: '#cce0f5', bg4: '#bbcfe8',
    border: '#c9a84c22', border2: '#c9a84c44',
    text: '#0d1e35', text2: '#2a4a70', text3: '#6a8aaa',
    accent: '#c9a84c', accent2: '#e8c96a', accent3: '#f5d87a',
    headerBg: '#cce0f5', headerBorder: '#c9a84c',
  },
  knockout: {
    bg: '#f7f9fb', bg2: '#ffffff', bg3: '#eef4f2', bg4: '#d6e6e0',
    border: '#d6e6e022', border2: '#d6e6e044',
    text: '#1a2e2a', text2: '#5a7a72', text3: '#8aaa9e',
    accent: '#0d7b6b', accent2: '#3a9e8a', accent3: '#6bc4b0',
    headerBg: '#e8f5f0', headerBorder: '#0d7b6b',
  }
}
