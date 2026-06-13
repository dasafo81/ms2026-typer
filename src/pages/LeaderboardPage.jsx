import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayer } from '../hooks/usePlayer'

// Odznaki za osiągnięcia
function computeBadges(playerName, allPreds, rows) {
  const badges = []
  const myPreds = allPreds
    .filter(p => p.players?.name === playerName)
    .sort((a, b) => new Date(a.matches?.kickoff_at) - new Date(b.matches?.kickoff_at))

  // Hat-trick — 3 dokładne z rzędu
  let exactStreak = 0, maxExact = 0
  for (const p of myPreds) {
    if (p.points_earned === 3) { exactStreak++; maxExact = Math.max(maxExact, exactStreak) }
    else exactStreak = 0
  }
  if (maxExact >= 3) badges.push({ icon: '🎩', label: 'Hat-trick', desc: '3 dokładne z rzędu' })

  // Żelazny typer — wytypował wszystkie rozegrane mecze
  const finishedCount = allPreds.filter(p => p.players?.name === playerName).length
  const row = rows.find(r => r.name === playerName)
  const totalFinished = allPreds.filter((p, i, arr) =>
    arr.findIndex(x => x.match_id === p.match_id) === i
  ).length
  if (finishedCount > 0 && finishedCount === totalFinished) badges.push({ icon: '🦾', label: 'Żelazny typer', desc: 'Wytypował każdy mecz' })

  // Snajper — 50%+ dokładnych (min 4 rozegrane)
  if (finishedCount >= 4 && Number(row?.exact_hits) / finishedCount >= 0.5)
    badges.push({ icon: '🎯', label: 'Snajper', desc: '50%+ dokładnych wyników' })

  // Czarna seria — 5+ pudeł z rzędu
  let missStreak = 0, maxMiss = 0
  for (const p of myPreds) {
    if ((p.points_earned || 0) === 0) { missStreak++; maxMiss = Math.max(maxMiss, missStreak) }
    else missStreak = 0
  }
  if (maxMiss >= 5) badges.push({ icon: '💀', label: 'Czarna seria', desc: `${maxMiss} pudeł z rzędu` })

  // Szczęściarz — trafił wynik z różnicą 3+ goli
  const bigUpset = myPreds.find(p =>
    p.points_earned === 3 &&
    Math.abs((p.matches?.home_score || 0) - (p.matches?.away_score || 0)) >= 3
  )
  if (bigUpset) badges.push({ icon: '🍀', label: 'Szczęściarz', desc: 'Trafił wynik z 3+ goli różnicy' })

  return badges
}

export default function LeaderboardPage() {
  const [rows, setRows] = useState([])
  const [stats, setStats] = useState({ onFire: null, sniper: null, unlucky: null })
  const [allPreds, setAllPreds] = useState([])
  const [dailyPoints, setDailyPoints] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [loading, setLoading] = useState(true)
  const { player } = usePlayer()

  useEffect(() => {
    load()
    const sub = supabase
      .channel('leaderboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'predictions' }, load)
      .subscribe()
    return () => sub.unsubscribe()
  }, [])

  async function load() {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const [{ data: leaderboard }, { data: recentMatches }, { data: allPredictions }, { data: daily }] = await Promise.all([
      supabase.from('leaderboard').select('*'),
      supabase.from('matches').select('id').eq('status', 'finished').gte('kickoff_at', since24h),
      supabase.from('predictions').select('*, players(name), matches(kickoff_at, status, home_score, away_score)'),
      supabase.from('daily_points').select('*')
    ])

    const allRows = leaderboard || []
    setRows(allRows)
    setDailyPoints(daily || [])

    const recentMatchIds = new Set((recentMatches || []).map(m => m.id))
    const preds = (allPredictions || []).filter(p => p.matches?.status === 'finished' && p.players)
    setAllPreds(preds)

    // 🔥 W gazie
    const recentPts = {}
    for (const p of preds) {
      if (recentMatchIds.has(p.match_id)) {
        const name = p.players.name
        recentPts[name] = (recentPts[name] || 0) + (p.points_earned || 0)
      }
    }
    const onFireEntry = Object.entries(recentPts)
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1]
        const aTotal = allRows.find(r => r.name === a[0])?.total_points || 0
        const bTotal = allRows.find(r => r.name === b[0])?.total_points || 0
        return bTotal - aTotal
      })[0]
    const onFire = onFireEntry && onFireEntry[1] > 0 ? { name: onFireEntry[0], pts: onFireEntry[1] } : null

    // 🎯 Snajper
    const finishedPerPlayer = {}
    for (const p of preds) {
      const name = p.players.name
      finishedPerPlayer[name] = (finishedPerPlayer[name] || 0) + 1
    }
    const sniperData = allRows
      .filter(r => (finishedPerPlayer[r.name] || 0) >= 3)
      .map(r => ({
        name: r.name,
        pct: Math.round((Number(r.exact_hits) / finishedPerPlayer[r.name]) * 100)
      }))
      .sort((a, b) => b.pct - a.pct)
    const sniper = sniperData[0]?.pct > 0 ? sniperData[0] : null

    // 😬 Pechowiec
    const streaks = {}
    for (const row of allRows) {
      const playerPreds = preds
        .filter(p => p.players.name === row.name)
        .sort((a, b) => new Date(a.matches.kickoff_at) - new Date(b.matches.kickoff_at))
      let streak = 0, maxStreak = 0
      for (const p of playerPreds) {
        if ((p.points_earned || 0) === 0) { streak++; maxStreak = Math.max(maxStreak, streak) }
        else streak = 0
      }
      streaks[row.name] = maxStreak
    }
    const unluckyEntry = Object.entries(streaks).sort((a, b) => b[1] - a[1])[0]
    const unlucky = unluckyEntry && unluckyEntry[1] >= 2 ? { name: unluckyEntry[0], streak: unluckyEntry[1] } : null

    setStats({ onFire, sniper, unlucky })
    setLoading(false)
  }

  const medals = ['🥇', '🥈', '🥉']

  // Wykres — zbierz wszystkie daty
  const allDates = [...new Set(dailyPoints.map(d => d.match_date))].sort()
  const last7 = allDates.slice(-7)

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>🏆 Tabela rankingowa</h1>
        <p style={{ color: 'var(--text2)', fontSize: 14 }}>Aktualizuje się w czasie rzeczywistym</p>
      </div>

      {/* Odznaki tygodnia */}
      {!loading && (stats.onFire || stats.sniper || stats.unlucky) && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {stats.onFire && <Badge icon="🔥" title="W gazie" name={stats.onFire.name} sub={`+${stats.onFire.pts} pkt w ostatnich 24h`} color="#b8952a" bg="#b8952a12" />}
          {stats.sniper && <Badge icon="🎯" title="Snajper" name={stats.sniper.name} sub={`${stats.sniper.pct}% dokładnych wyników`} color="#1a7a4a" bg="#1a7a4a12" />}
          {stats.unlucky && <Badge icon="😬" title="Pechowiec" name={stats.unlucky.name} sub={`${stats.unlucky.streak} pudeł z rzędu`} color="#c0392b" bg="#c0392b12" />}
        </div>
      )}

      {/* Wykres punktów w czasie */}
      {!loading && last7.length > 1 && (
        <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 12, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            📈 Punkty w czasie
          </div>
          <PointsChart rows={rows} dailyPoints={dailyPoints} dates={last7} />
        </div>
      )}

      {loading ? <Skeleton /> : rows.length === 0 ? <Empty /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((row, i) => {
            const isMe = row.id === player?.id
            const medal = medals[i]
            const finishedCount = allPreds.filter(p => p.players?.name === row.name).length
            const exactPct = finishedCount > 0 ? Math.round((Number(row.exact_hits) / finishedCount) * 100) : 0
            const badges = computeBadges(row.name, allPreds, rows)
            const isExpanded = expanded === row.id

            // Forma tygodnia — ostatnie 7 rozegranych typów
            const myRecent = allPreds
              .filter(p => p.players?.name === row.name)
              .sort((a, b) => new Date(b.matches?.kickoff_at) - new Date(a.matches?.kickoff_at))
              .slice(0, 7)
              .reverse()

            return (
              <div key={row.id}>
                <div
                  className="card"
                  onClick={() => setExpanded(isExpanded ? null : row.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 18px',
                    border: isMe ? '1px solid var(--gold)' : '1px solid #e8e0d0',
                    background: isMe ? '#b8952a08' : 'var(--bg2)',
                    cursor: 'pointer', transition: 'all 0.15s',
                    borderBottomLeftRadius: isExpanded ? 0 : undefined,
                    borderBottomRightRadius: isExpanded ? 0 : undefined,
                  }}
                >
                  <div style={{ width: 32, textAlign: 'center', fontSize: medal ? 20 : 14, fontWeight: 700, color: medal ? undefined : 'var(--text3)', fontFamily: 'Space Grotesk' }}>
                    {medal || i + 1}
                  </div>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: row.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {row.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: isMe ? 'var(--gold)' : 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {row.name}
                      {isMe && <span style={{ fontSize: 11, color: 'var(--gold2)', fontWeight: 400 }}>(ty)</span>}
                      {stats.onFire?.name === row.name && <span title="W gazie">🔥</span>}
                      {stats.sniper?.name === row.name && <span title="Snajper">🎯</span>}
                      {stats.unlucky?.name === row.name && <span title="Pechowiec">😬</span>}
                      {badges.map(b => <span key={b.label} title={b.desc}>{b.icon}</span>)}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                      {row.predictions_count} typów · {finishedCount} rozegranych
                      {Number(row.exact_hits) > 0 && ` · ${row.exact_hits}× dokładny`}
                      {exactPct > 0 && ` · ${exactPct}% celność`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ textAlign: 'center', minWidth: 36 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#1a7a4a', fontFamily: 'Space Grotesk' }}>{row.exact_hits}</div>
                      <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>cel</div>
                    </div>
                    <div style={{ textAlign: 'center', minWidth: 36 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)', fontFamily: 'Space Grotesk' }}>{row.result_hits}</div>
                      <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>1X2</div>
                    </div>
                    <div style={{ background: isMe ? '#b8952a18' : 'var(--bg3)', borderRadius: 10, padding: '6px 14px', textAlign: 'center', minWidth: 64, border: isMe ? '1px solid #b8952a44' : 'none' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Space Grotesk', color: isMe ? 'var(--gold)' : 'var(--text)' }}>{row.total_points}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>pkt</div>
                    </div>
                  </div>
                </div>

                {/* Rozwinięcie — forma tygodnia + odznaki */}
                {isExpanded && (
                  <div style={{
                    background: '#faf8f4', border: '1px solid #e8e0d0',
                    borderTop: 'none', borderRadius: '0 0 12px 12px',
                    padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12
                  }}>
                    {/* Forma tygodnia */}
                    {myRecent.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
                          Forma — ostatnie {myRecent.length} rozegranych
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {myRecent.map((p, idx) => (
                            <div key={idx} title={`${p.pred_home}:${p.pred_away}`} style={{
                              width: 32, height: 32, borderRadius: 8,
                              background: p.points_earned === 3 ? '#1a7a4a' : p.points_earned === 1 ? '#b8952a' : '#e8e0d0',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 13, fontWeight: 700,
                              color: p.points_earned > 0 ? '#fff' : 'var(--text3)'
                            }}>
                              {p.points_earned === 3 ? '🎯' : p.points_earned === 1 ? '✓' : '✗'}
                            </div>
                          ))}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                          🟢 dokładny · 🟡 wynik · ⬜ pudło
                        </div>
                      </div>
                    )}

                    {/* Odznaki */}
                    {badges.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
                          Odznaki
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {badges.map(b => (
                            <div key={b.label} style={{
                              display: 'flex', alignItems: 'center', gap: 6,
                              background: '#fff', border: '1px solid #e8e0d0',
                              borderRadius: 8, padding: '6px 12px', fontSize: 13
                            }}>
                              <span>{b.icon}</span>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 12 }}>{b.label}</div>
                                <div style={{ fontSize: 10, color: 'var(--text3)' }}>{b.desc}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {badges.length === 0 && myRecent.length === 0 && (
                      <div style={{ fontSize: 13, color: 'var(--text3)' }}>Brak danych — typuj więcej meczów!</div>
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
          {[
            { label: 'Graczy', value: rows.length },
            { label: 'Typów łącznie', value: rows.reduce((s, r) => s + Number(r.predictions_count), 0) },
            { label: 'Lider', value: rows[0]?.name || '–' },
          ].map(s => (
            <div key={s.label} className="card" style={{ flex: 1, minWidth: 120, padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Space Grotesk' }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PointsChart({ rows, dailyPoints, dates }) {
  // Skumulowane punkty per gracz per dzień
  const colors = ['#b8952a','#1a7a4a','#c0392b','#1e88e5','#8e24aa','#f4511e','#00897b','#546e7a','#6d4c41','#e53935']
  const top5 = rows.slice(0, 5)

  const cumulative = top5.map((row, ri) => {
    let sum = 0
    return dates.map(date => {
      const entry = dailyPoints.find(d => d.name === row.name && d.match_date === date)
      sum += entry ? Number(entry.day_points) : 0
      return sum
    })
  })

  const maxPts = Math.max(...cumulative.flat(), 1)
  const W = 580, H = 140, PAD = 32

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H + PAD}`} style={{ display: 'block' }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => (
          <line key={t} x1={40} y1={H * (1 - t)} x2={W - 10} y2={H * (1 - t)}
            stroke="#e8e0d0" strokeWidth="1" strokeDasharray={t === 0 ? '0' : '3,3'} />
        ))}

        {/* Lines per player */}
        {top5.map((row, ri) => {
          const pts = cumulative[ri]
          const points = dates.map((_, di) => {
            const x = 40 + (di / (dates.length - 1)) * (W - 50)
            const y = H - (pts[di] / maxPts) * H
            return `${x},${y}`
          }).join(' ')
          return (
            <g key={row.id}>
              <polyline points={points} fill="none" stroke={colors[ri % colors.length]} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              {dates.map((_, di) => {
                const x = 40 + (di / (dates.length - 1)) * (W - 50)
                const y = H - (pts[di] / maxPts) * H
                return <circle key={di} cx={x} cy={y} r="3.5" fill={colors[ri % colors.length]} />
              })}
            </g>
          )
        })}

        {/* X labels */}
        {dates.map((date, di) => {
          const x = 40 + (di / (dates.length - 1)) * (W - 50)
          const label = date.slice(5) // MM-DD
          return <text key={di} x={x} y={H + 18} textAnchor="middle" fontSize="10" fill="#9a8a6a">{label}</text>
        })}
      </svg>

      {/* Legenda */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
        {top5.map((row, ri) => (
          <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <div style={{ width: 12, height: 3, background: colors[ri % colors.length], borderRadius: 2 }} />
            <span style={{ color: 'var(--text2)' }}>{row.name}</span>
          </div>
        ))}
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
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{name}</div>
        <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 1 }}>{sub}</div>
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="card" style={{ height: 68, opacity: 0.3, background: 'var(--bg3)' }} />
      ))}
    </div>
  )
}

function Empty() {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text2)' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🏜️</div>
      <div style={{ fontSize: 16, fontWeight: 600 }}>Ranking pusty</div>
      <div style={{ fontSize: 13, marginTop: 6 }}>Zaproś znajomych i zacznijcie typować!</div>
    </div>
  )
}
