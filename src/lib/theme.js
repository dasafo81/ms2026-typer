export function isKnockoutPhase(matches) {
  if (!matches || matches.length === 0) return false
  return matches.some(m => m.stage && m.stage !== 'group' && m.stage !== 'GROUP_STAGE')
}

const STAGE_RAW = {
  r32: 'r32', LAST_32: 'r32', ROUND_OF_32: 'r32',
  r16: 'r16', LAST_16: 'r16', ROUND_OF_16: 'r16',
  qf: 'qf', QUARTER_FINALS: 'qf', QUARTER_FINAL: 'qf',
  sf: 'sf', SEMI_FINALS: 'sf', SEMI_FINAL: 'sf',
  final: 'final', FINAL: 'final'
}

export function currentKnockoutStage(matches) {
  if (!matches || matches.length === 0) return null
  const ORDER = ['r32', 'r16', 'qf', 'sf', 'final']
  // Najwcześniejsza runda, która ma jeszcze niedograne mecze z prawdziwymi drużynami.
  // Jak wszystkie dograne — ostatnia z prawdziwymi drużynami.
  let last = null
  for (const s of ORDER) {
    const real = matches.filter(m =>
      STAGE_RAW[m.stage] === s && m.home_team && m.home_team !== 'TBD'
    )
    if (real.length === 0) continue
    last = s
    if (real.some(m => m.status === 'scheduled' || m.status === 'live')) return s
  }
  return last
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
    bg: '#fdf6ec', bg2: '#ffffff', bg3: '#faeeda', bg4: '#f0dcb8',
    border: '#e8d5b022', border2: '#e8d5b044',
    text: '#171310', text2: '#4a4038', text3: '#9a866c',
    accent: '#d97706', accent2: '#f59e0b', accent3: '#fbbf24',
    headerBg: '#faeeda', headerBorder: '#d97706',
  }
}
