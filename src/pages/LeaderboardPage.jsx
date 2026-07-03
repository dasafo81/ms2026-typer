import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayer } from '../hooks/usePlayer'
import { useTheme } from '../hooks/useTheme'
import { STAGE_PROGRESS } from '../lib/theme'
import { flagFor } from '../lib/flags'

// Łączne punkty za typ: wynik + awans + karne + dogrywka
function totalPredPoints(p) {
  return (p.points_earned || 0) + (p.pts_advancement || 0) + (p.pts_penalty || 0) + (p.pts_extra_time || 0)
}

function computeBadges(playerName, allPreds, rows, isBlackSeriesChamp = false, blackSeriesCount = 0) {
  const badges = []
  const myPreds = allPreds.filter(p => p.players?.name === playerName).sort((a, b) => new Date(a.matches?.kickoff_at) - new Date(b.matches?.kickoff_at))
  let exactStreak = 0, goldCount = 0
  for (const p of myPreds) { if (p.points_earned === 3) { exactStreak++; if (exactStreak % 3 === 0) goldCount++ } else exactStreak = 0 }
  if (goldCount > 0) badges.push({ icon: '🎩', label: 'Hat-trick złoty', desc: '3 dokładne wyniki z rzędu', count: goldCount })
  let hitStreak = 0, silverCount = 0
  for (const p of myPreds) { if ((p.points_earned || 0) > 0) { hitStreak++; if (hitStreak % 3 === 0) silverCount++ } else hitStreak = 0 }
  if (silverCount > 0 && goldCount === 0) badges.push({ icon: '🎪', label: 'Hat-trick srebrny', desc: '3 trafione wyniki z rzędu', count: silverCount })
  const finishedCount = allPreds.filter(p => p.players?.name === playerName).length
  const row = rows.find(r => r.name === playerName)
  const totalFinished = allPreds.filter((p, i, arr) => arr.findIndex(x => x.match_id === p.match_id) === i).length
  if (finishedCount > 0 && finishedCount === totalFinished) badges.push({ icon: '🦾', label: 'Żelazny typer', desc: 'Wytypował każdy mecz' })
  if (finishedCount >= 4 && Number(row?.exact_hits) / finishedCount >= 0.5) badges.push({ icon: '🎯', label: 'Snajper', desc: '50%+ dokładnych wyników' })
  if (isBlackSeriesChamp && blackSeriesCount >= 5) badges.push({ icon: '💀', label: 'Czarna seria', desc: `Rekord: ${blackSeriesCount} pudeł z rzędu` })
  const bigUpset = myPreds.find(p => p.points_earned === 3 && Math.abs((p.matches?.home_score || 0) - (p.matches?.away_score || 0)) >= 3)
  if (bigUpset) badges.push({ icon: '🍀', label: 'Szczęściarz', desc: 'Trafił wynik z 3+ goli różnicy' })

  // === ODZNAKI PUCHAROWE ===
  const knockoutPreds = allPreds.filter(p => p.matches?.stage && p.matches.stage !== 'group' && p.players?.name === playerName)
  const groupPreds = allPreds.filter(p => p.matches?.stage === 'group' && p.players?.name === playerName)
  const myAllPreds = allPreds.filter(p => p.players?.name === playerName).sort((a,b) => new Date(a.matches?.kickoff_at) - new Date(b.matches?.kickoff_at))

  // 🎯 Snajper pucharowy — 3+ dokładnych w fazie pucharowej
  const kExact = knockoutPreds.filter(p => p.points_earned === 3).length
  if (kExact >= 3) badges.push({ icon: '🎯', label: 'Snajper pucharowy', desc: `${kExact}× dokładny wynik w fazie pucharowej` })

  // 🦅 Orzeł — trafił wszystkie awanse w jednej rundzie (min 4 mecze w rundzie)
  const advByStage = {}
  for (const p of knockoutPreds) {
    const s = p.matches?.stage
    if (!advByStage[s]) advByStage[s] = { hit: 0, total: 0 }
    if (p.pred_winner) { advByStage[s].total++; if (p.pts_advancement > 0) advByStage[s].hit++ }
  }
  const eagleRound = Object.values(advByStage).find(s => s.total >= 4 && s.hit === s.total)
  if (eagleRound) badges.push({ icon: '🦅', label: 'Orzeł', desc: 'Trafił wszystkie awanse w jednej rundzie' })

  // 💎 Diament — dokładny wynik w finale
  const finalExact = knockoutPreds.find(p => p.matches?.stage === 'final' && p.points_earned === 3)
  if (finalExact) badges.push({ icon: '💎', label: 'Diament', desc: 'Dokładny wynik w finale!' })

  // 🐙 Paul — 5+ trafionych awansów z rzędu
  let awansStreak = 0, maxAwans = 0
  for (const p of knockoutPreds) {
    if (p.pts_advancement > 0) { awansStreak++; maxAwans = Math.max(maxAwans, awansStreak) } else awansStreak = 0
  }
  if (maxAwans >= 5) badges.push({ icon: '🐙', label: 'Paul', desc: `${maxAwans} trafionych awansów z rzędu jak ośmiornica` })

  // 🎲 Ruletka — trafił awans typując remis po 90 min (czyli szedł na dogrywkę i karne)
  const roulette = knockoutPreds.find(p =>
    p.pred_home !== null && p.pred_away !== null &&
    p.pred_home === p.pred_away &&
    p.pts_advancement > 0
  )
  if (roulette) badges.push({ icon: '🎲', label: 'Ruletka', desc: 'Trafił awans typując remis po 90 min' })

  // 🕵️ Agent Karingtony — wytypował wszystkie mecze fazy pucharowej
  const totalKnockout = new Set(knockoutPreds.map(p => p.match_id)).size
  const allKnockoutMatches = new Set(allPreds.filter(p => p.matches?.stage && p.matches.stage !== 'group').map(p => p.match_id)).size
  if (totalKnockout > 0 && totalKnockout === allKnockoutMatches && allKnockoutMatches >= 4)
    badges.push({ icon: '🕵️', label: 'Agent Karingtony', desc: 'Wytypował każdy mecz fazy pucharowej' })

  // 🎪 Cyrkowiec — trafił karne I dogrywkę w tym samym meczu
  const circus = knockoutPreds.find(p => p.pts_extra_time > 0 && p.pts_penalty > 0)
  if (circus) badges.push({ icon: '🎪', label: 'Cyrkowiec', desc: 'Trafił dogrywkę i karne w jednym meczu!' })

  // 🧊 Lodówka — nie trafił ani jednego awansu w fazie pucharowej (min 4 wytypowane)
  const totalAdvPreds = knockoutPreds.filter(p => p.pred_winner && p.matches?.status === 'finished').length
  const hitAdv = knockoutPreds.filter(p => p.pts_advancement > 0).length
  if (totalAdvPreds >= 4 && hitAdv === 0) badges.push({ icon: '🧊', label: 'Lodówka', desc: 'Ani jednego trafionego awansu' })

  // 💸 Hazardzista — typuje remis w fazie pucharowej (min 3 razy)
  const drawBets = knockoutPreds.filter(p => p.pred_home !== null && p.pred_away !== null && p.pred_home === p.pred_away).length
  if (drawBets >= 3) badges.push({ icon: '💸', label: 'Hazardzista', desc: `Typuje remisy w pucharze (${drawBets}×)` })

  // 🐔 Kurczak — nigdy nie typuje remisu w fazie pucharowej (min 8 wytypowanych)
  const knockoutTyped = knockoutPreds.filter(p => p.pred_home !== null && p.pred_away !== null).length
  if (knockoutTyped >= 8 && drawBets === 0) badges.push({ icon: '🐔', label: 'Kurczak', desc: 'Boi się remisów w fazie pucharowej' })

  // 🔮 Wróżbita — trafił dogrywkę
  const hitET = knockoutPreds.filter(p => p.pts_extra_time > 0).length
  if (hitET >= 1) badges.push({ icon: '🔮', label: 'Wróżbita', desc: `${hitET}× trafiona dogrywka`, count: hitET > 1 ? hitET : 0 })

  // 🥊 Karniarz — trafił karne
  const hitPen = knockoutPreds.filter(p => p.pts_penalty > 0).length
  if (hitPen >= 1) badges.push({ icon: '🥊', label: 'Karniarz', desc: `${hitPen}× trafione karne`, count: hitPen > 1 ? hitPen : 0 })



  // 👻 Duch — nie wytypował ani jednego meczu pucharowego
  if (allKnockoutMatches >= 4 && totalKnockout === 0) badges.push({ icon: '👻', label: 'Duch', desc: 'Zniknął w fazie pucharowej' })

  // 👑 Król pucharu — 3+ dokładnych w fazie pucharowej
  if (kExact >= 3) {} // już mamy Snajpera pucharowego — nie duplikuj

  return badges
}

export default function LeaderboardPage() {
  const [rows, setRows] = useState([])
  const [stats, setStats] = useState({ onFire: null, sniper: null, unlucky: null })
  const [allPreds, setAllPreds] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [loading, setLoading] = useState(true)
  const { player } = usePlayer()
  const { theme, knockout, currentStage } = useTheme()
  const [knockoutFlags, setKnockoutFlags] = useState([])
  const [nextMatch, setNextMatch] = useState(null)

  // Sprawdź czy jest faza pucharowa na podstawie danych
  const [isKnockout, setIsKnockout] = useState(false)
  useEffect(() => {
    supabase.from('matches').select('stage, status, kickoff_at, home_team, away_team, home_flag, away_flag').then(({ data }) => {
      if (!data) return
      const ko = data.filter(m => m.stage && m.stage !== 'group' && m.stage !== 'GROUP_STAGE')
      if (ko.length === 0) return
      setIsKnockout(true)

      // Flaga: baza jeśli jest, potem słownik z lib/flags.js
      const flagMap = {}
      for (const m of data) {
        if (m.home_team && m.home_flag) flagMap[m.home_team] = m.home_flag
        if (m.away_team && m.away_flag) flagMap[m.away_team] = m.away_flag
      }
      const flagOf = (team, dbFlag) => dbFlag || flagMap[team] || flagFor(team) || null

      const stageKey = currentStage || 'r16'
      const stageMatches = ko.filter(m => m.stage === stageKey && m.home_team && m.home_team !== 'TBD')
      const flags = [...new Set(
        stageMatches.flatMap(m => [flagOf(m.home_team, m.home_flag), flagOf(m.away_team, m.away_flag)]).filter(Boolean)
      )]
      setKnockoutFlags(flags)

      // Najbliższy zaplanowany mecz z prawdziwymi drużynami (+ uzupełnione flagi)
      const now = Date.now()
      const upcoming = ko
        .filter(m => m.status === 'scheduled' && m.home_team && m.home_team !== 'TBD' && new Date(m.kickoff_at).getTime() > now)
        .sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at))
      const nm = upcoming[0] || null
      setNextMatch(nm ? { ...nm, home_flag: flagOf(nm.home_team, nm.home_flag), away_flag: flagOf(nm.away_team, nm.away_flag) } : null)
    })
  }, [currentStage])

  useEffect(() => {
    load()
    const sub = supabase.channel('leaderboard').on('postgres_changes', { event: '*', schema: 'public', table: 'predictions' }, load).subscribe()
    return () => sub.unsubscribe()
  }, [])

  async function load() {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const [{ data: leaderboard }, { data: recentMatches }, { data: allPredictions }] = await Promise.all([
      supabase.from('leaderboard').select('*'),
      supabase.from('matches').select('id').eq('status', 'finished').gte('kickoff_at', since24h),
      supabase.from('predictions').select('*, players(name), matches(kickoff_at, status, home_score, away_score)')
    ])
    const allRows = leaderboard || []
    setRows(allRows)
    const recentMatchIds = new Set((recentMatches || []).map(m => m.id))
    const preds = (allPredictions || []).filter(p => p.matches?.status === 'finished' && p.players)
    setAllPreds(preds)
    const recentPts = {}
    for (const p of preds) {
      if (recentMatchIds.has(p.match_id)) {
        const name = p.players.name
        recentPts[name] = (recentPts[name] || 0) + totalPredPoints(p)
      }
    }
    const onFireEntry = Object.entries(recentPts).sort((a, b) => { if (b[1] !== a[1]) return b[1] - a[1]; const aT = allRows.find(r => r.name === a[0])?.total_points || 0; const bT = allRows.find(r => r.name === b[0])?.total_points || 0; return bT - aT })[0]
    const onFire = onFireEntry && onFireEntry[1] > 0 ? { name: onFireEntry[0], pts: onFireEntry[1] } : null
    const finishedPerPlayer = {}
    for (const p of preds) { const name = p.players.name; finishedPerPlayer[name] = (finishedPerPlayer[name] || 0) + 1 }
    const totalFinishedMatches = new Set(preds.map(p => p.match_id)).size
    const sniperData = allRows.filter(r => (finishedPerPlayer[r.name] || 0) === totalFinishedMatches && totalFinishedMatches >= 3).map(r => ({ name: r.name, pct: Math.round((Number(r.exact_hits) / finishedPerPlayer[r.name]) * 100) })).sort((a, b) => b.pct - a.pct)
    const sniper = sniperData[0]?.pct > 0 ? sniperData[0] : null
    const streaks = {}
    for (const row of allRows) {
      const playerPreds = preds.filter(p => p.players.name === row.name).sort((a, b) => new Date(a.matches.kickoff_at) - new Date(b.matches.kickoff_at))
      let streak = 0
      for (let i = playerPreds.length - 1; i >= 0; i--) { if (totalPredPoints(playerPreds[i]) === 0) streak++; else break }
      streaks[row.name] = streak
    }
    const unluckyEntry = Object.entries(streaks).sort((a, b) => b[1] - a[1])[0]
    const unlucky = unluckyEntry && unluckyEntry[1] >= 2 ? { name: unluckyEntry[0], streak: unluckyEntry[1] } : null
    setStats({ onFire, sniper, unlucky })
    setLoading(false)
  }

  const medals = ['🥇', '🥈', '🥉']
  const missStreaks = rows.map(r => {
    const rPreds = allPreds.filter(p => p.players?.name === r.name).sort((a, b) => new Date(a.matches?.kickoff_at) - new Date(b.matches?.kickoff_at))
    let maxMiss = 0, cur = 0
    for (const p of rPreds) { if (totalPredPoints(p) === 0) { cur++; maxMiss = Math.max(maxMiss, cur) } else cur = 0 }
    return { name: r.name, max: maxMiss }
  })
  const topMiss = [...missStreaks].sort((a, b) => b.max - a.max)[0]

  const t = theme

  return (
    <div>
      {isKnockout && <KnockoutProgress currentStage={currentStage} theme={t} flags={knockoutFlags} nextMatch={nextMatch} />}

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4, color: t.text }}>🏆 Tabela rankingowa</h1>
        <p style={{ color: t.text2, fontSize: 14 }}>Aktualizuje się w czasie rzeczywistym</p>
      </div>

      {!loading && (stats.onFire || stats.sniper || stats.unlucky) && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {stats.onFire && <Badge icon="🔥" title="W gazie" name={stats.onFire.name} sub={`+${stats.onFire.pts} pkt w ostatnich 24h`} color={t.accent} bg={`${t.accent}12`} />}
          {stats.sniper && <Badge icon="🏹" title="Snajper" name={stats.sniper.name} sub={`${stats.sniper.pct}% dokładnych wyników`} color="#1a7a4a" bg="#1a7a4a12" />}
          {stats.unlucky && <Badge icon="😭" title="Pechowiec" name={stats.unlucky.name} sub={`${stats.unlucky.streak} pudła z rzędu`} color="#c0392b" bg="#c0392b12" />}
        </div>
      )}

      {loading ? <Skeleton t={t} /> : rows.length === 0 ? <Empty t={t} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((row, i) => {
            const isMe = row.id === player?.id
            const isLast = i === rows.length - 1
            const medal = medals[i]
            const finishedCount = allPreds.filter(p => p.players?.name === row.name).length
            const exactPct = finishedCount > 0 ? Math.round((Number(row.exact_hits) / finishedCount) * 100) : 0
            const isBlackChamp = topMiss && topMiss.name === row.name && topMiss.max >= 5
            const badges = computeBadges(row.name, allPreds, rows, isBlackChamp, topMiss?.max || 0)
            const isExpanded = expanded === row.id
            const myRecent = allPreds.filter(p => p.players?.name === row.name).sort((a, b) => new Date(b.matches?.kickoff_at) - new Date(a.matches?.kickoff_at)).slice(0, 7).reverse()

            return (
              <div key={row.id}>
                <div onClick={() => setExpanded(isExpanded ? null : row.id)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: isMe ? `${t.accent}08` : t.bg2, border: isMe ? `1px solid ${t.accent}` : `1px solid ${t.border || '#e8e0d0'}`, borderRadius: isExpanded ? '12px 12px 0 0' : 12, cursor: 'pointer', transition: 'all 0.15s' }}>
                  <div style={{ width: 32, textAlign: 'center', fontSize: medal || isLast ? 20 : 14, fontWeight: 700, color: medal ? undefined : isLast ? undefined : t.text3, fontFamily: 'Space Grotesk' }}>
                    {medal || (isLast ? '🔴' : i + 1)}
                  </div>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: row.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {row.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: isMe ? t.accent : t.text, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {row.name}
                      {isMe && <span style={{ fontSize: 11, color: t.accent2, fontWeight: 400 }}>(ty)</span>}
                      {stats.onFire?.name === row.name && <span title="W gazie">🔥</span>}
                      {stats.sniper?.name === row.name && <span title="Snajper">🏹</span>}
                      {stats.unlucky?.name === row.name && <span title="Pechowiec">😭</span>}
                      {badges.map(b => <span key={b.label} title={b.desc}>{b.icon}</span>)}
                    </div>
                    <div style={{ fontSize: 12, color: t.text2, marginTop: 2 }}>
                      {row.predictions_count} typów · {finishedCount} rozegranych{Number(row.exact_hits) > 0 && ` · ${row.exact_hits}× dokładny`}{exactPct > 0 && ` · ${exactPct}% celność`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ textAlign: 'center', minWidth: 36 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#1a7a4a', fontFamily: 'Space Grotesk' }}>{row.exact_hits}</div>
                      <div style={{ fontSize: 9, color: t.text3, textTransform: 'uppercase', letterSpacing: 0.5 }}>cel</div>
                    </div>
                    <div style={{ textAlign: 'center', minWidth: 36 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: t.accent, fontFamily: 'Space Grotesk' }}>{row.result_hits}</div>
                      <div style={{ fontSize: 9, color: t.text3, textTransform: 'uppercase', letterSpacing: 0.5 }}>1X2</div>
                    </div>
                    <div style={{ background: isMe ? `${t.accent}18` : t.bg3, borderRadius: 10, padding: '6px 14px', textAlign: 'center', minWidth: 64, border: isMe ? `1px solid ${t.accent}44` : 'none' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Space Grotesk', color: isMe ? t.accent : t.text }}>{row.total_points}</div>
                      <div style={{ fontSize: 10, color: t.text3, marginTop: 1 }}>pkt</div>
                    </div>
                  </div>
                </div>
                {isExpanded && (
                  <div style={{ background: t.bg3, border: `1px solid ${t.border || '#e8e0d0'}`, borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {myRecent.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: t.text3, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Forma — ostatnie {myRecent.length} rozegranych</div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {myRecent.map((p, idx) => (
                            <div key={idx} title={`${p.pred_home}:${p.pred_away}`} style={{ width: 32, height: 32, borderRadius: 8, background: p.points_earned === 3 ? '#1a7a4a' : p.points_earned === 1 ? t.accent : t.bg4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: p.points_earned > 0 ? '#fff' : t.text3 }}>
                              {p.points_earned === 3 ? '🎯' : p.points_earned === 1 ? '✓' : '✗'}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {badges.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: t.text3, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Odznaki</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {badges.map(b => (
                            <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 6, background: t.bg2, border: `1px solid ${t.border || '#e8e0d0'}`, borderRadius: 8, padding: '6px 12px', fontSize: 13 }}>
                              <span>{b.icon}</span>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, color: t.text }}>
                                  {b.label}
                                  {b.count > 1 && <span style={{ background: t.accent, color: knockout ? '#0f0e17' : '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 800 }}>×{b.count}</span>}
                                </div>
                                <div style={{ fontSize: 10, color: t.text3 }}>{b.desc}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {rows.length > 0 && (
        <div style={{ marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[{ label: 'Graczy', value: rows.length }, { label: 'Typów łącznie', value: rows.reduce((s, r) => s + Number(r.predictions_count), 0) }, { label: 'Lider', value: rows[0]?.name || '–' }].map(s => (
            <div key={s.label} style={{ flex: 1, minWidth: 120, padding: '12px 16px', background: t.bg2, border: `1px solid ${t.border || '#e8e0d0'}`, borderRadius: 12 }}>
              <div style={{ fontSize: 11, color: t.text2, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Space Grotesk', color: t.text }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function useCountdown(targetIso) {
  const [left, setLeft] = useState(null)
  useEffect(() => {
    if (!targetIso) { setLeft(null); return }
    const target = new Date(targetIso).getTime()
    const tick = () => setLeft(Math.max(0, Math.floor((target - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [targetIso])
  return left
}

function fmtCountdown(secs) {
  if (secs === null || secs === undefined) return null
  const d = Math.floor(secs / 86400)
  const h = Math.floor((secs % 86400) / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (d > 0) return `${d}d ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function KnockoutProgress({ currentStage, theme: t, flags = [], nextMatch }) {
  const stages = ['r32', 'r16', 'qf', 'sf', 'final']
  const currentIdx = stages.indexOf(currentStage)
  const info = STAGE_PROGRESS[currentStage]
  const countdown = useCountdown(nextMatch?.kickoff_at)
  const cdText = fmtCountdown(countdown)

  return (
    <div style={{
      marginBottom: 20,
      background: `linear-gradient(135deg, ${t.accent}14, ${t.accent}08)`,
      border: `1px solid ${t.accent}25`,
      borderRadius: 14,
      overflow: 'hidden'
    }}>
      <style>{`
        @keyframes kt-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes kt-pulse { from { box-shadow: 0 0 0 0 ${t.accent}66; } to { box-shadow: 0 0 0 10px transparent; } }
      `}</style>

      {/* Marquee flag */}
      {flags.length > 0 && (
        <div style={{
          overflow: 'hidden', whiteSpace: 'nowrap',
          background: `${t.accent}0e`,
          borderBottom: `1px solid ${t.accent}1a`,
          padding: '7px 0'
        }}>
          <div style={{ display: 'inline-flex', gap: 22, fontSize: 16, animation: 'kt-marquee 36s linear infinite' }}>
            {[...flags, ...flags].map((f, i) => <span key={i}>{f}</span>)}
          </div>
        </div>
      )}

      <div style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>{info?.icon || '🏆'}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.accent }}>{info?.label || 'Faza pucharowa'}</div>
              <div style={{ fontSize: 11, color: t.text3, marginTop: 2 }}>awans +2 pkt · karne +1 pkt</div>
            </div>
          </div>

          {/* Najbliższy mecz + countdown */}
          {nextMatch && cdText && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14,
              background: t.bg2, border: `1px solid ${t.bg4}`,
              borderRadius: 10, padding: '8px 16px'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: t.text3, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Najbliższy mecz</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
                  {nextMatch.home_flag} {nextMatch.home_team} – {nextMatch.away_team} {nextMatch.away_flag}
                </div>
              </div>
              <div style={{ width: 1, height: 32, background: t.bg4 }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: t.text3, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Kick-off za</div>
                <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Space Grotesk, monospace', color: '#c9884c' }}>{cdText}</div>
              </div>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 16 }}>
          {stages.map((s, i) => {
            const isPast = i < currentIdx
            const isCurrent = i === currentIdx
            const isLast = i === stages.length - 1
            const sp = STAGE_PROGRESS[s]

            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', flex: isLast ? 0 : 1 }}>
                <div style={{
                  width: isCurrent ? 30 : 22, height: isCurrent ? 30 : 22,
                  borderRadius: '50%',
                  background: isCurrent ? t.accent : isPast ? t.accent + '88' : t.bg3,
                  border: !isPast && !isCurrent ? `1px solid ${t.bg4}` : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: isCurrent ? 13 : 10, fontWeight: 700,
                  color: isPast || isCurrent ? '#fff' : t.text3,
                  flexShrink: 0,
                  animation: isCurrent ? 'kt-pulse 2s ease-out infinite' : 'none'
                }}>
                  {isCurrent ? sp.icon : isPast ? '✓' : (isLast ? '🏆' : i + 1)}
                </div>
                {!isLast && (
                  <div style={{ flex: 1, height: 2, minWidth: 8, background: isPast ? t.accent + '66' : t.bg4, borderRadius: 1 }} />
                )}
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', marginTop: 5 }}>
          {stages.map((s, i) => {
            const isCurrent = i === currentIdx
            const isLast = i === stages.length - 1
            return (
              <div key={s} style={{ flex: isLast ? 0 : 1 }}>
                <div style={{
                  fontSize: 9, color: isCurrent ? t.accent : t.text3,
                  fontWeight: isCurrent ? 700 : 400,
                  width: isCurrent ? 30 : 22, textAlign: 'center'
                }}>
                  {STAGE_PROGRESS[s].short}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Badge({ icon, title, name, sub, color, bg }) {
  return (
    <div style={{ flex: 1, minWidth: 180, background: bg, border: `1px solid ${color}30`, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ fontSize: 28, lineHeight: 1 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{name}</div>
        <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>{sub}</div>
      </div>
    </div>
  )
}
function Skeleton({ t }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[...Array(5)].map((_, i) => <div key={i} style={{ height: 68, opacity: 0.3, background: t.bg3, borderRadius: 12 }} />)}</div>
}
function Empty({ t }) {
  return <div style={{ textAlign: 'center', padding: '60px 20px', color: t.text2 }}><div style={{ fontSize: 40, marginBottom: 12 }}>🏜️</div><div style={{ fontSize: 16, fontWeight: 600 }}>Ranking pusty</div></div>
}
