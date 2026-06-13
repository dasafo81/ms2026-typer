import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayer } from '../hooks/usePlayer'

export default function LeaderboardPage() {
  const [rows, setRows] = useState([])
  const [stats, setStats] = useState({ onFire: null, sniper: null, unlucky: null })
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

    const [{ data: leaderboard }, { data: recentMatches }, { data: allPredictions }] = await Promise.all([
      supabase.from('leaderboard').select('*'),
      supabase.from('matches').select('id').eq('status', 'finished').gte('kickoff_at', since24h),
      supabase.from('predictions').select('*, players(name), matches(kickoff_at, status)').eq('matches.status', 'finished')
    ])

    const allRows = leaderboard || []
    setRows(allRows)

    const recentMatchIds = new Set((recentMatches || []).map(m => m.id))
    const allPreds = (allPredictions || []).filter(p => p.matches && p.players)

    // Statystyki
    const now = new Date()

    // 🔥 W gazie — najwięcej punktów w ostatnich 24h
    const recentPts = {}
    for (const p of allPreds) {
      if (recentMatchIds.has(p.match_id)) {
        const name = p.players.name
        recentPts[name] = (recentPts[name] || 0) + (p.points_earned || 0)
      }
    }
    const onFireEntry = Object.entries(recentPts).sort((a, b) => b[1] - a[1])[0]
    const onFire = onFireEntry && onFireEntry[1] > 0
      ? { name: onFireEntry[0], pts: onFireEntry[1] }
      : null

    // 🎯 Snajper — najwyższy % dokładnych wyników (min 3 typy)
    const sniperData = allRows
      .filter(r => Number(r.predictions_count) >= 3)
      .map(r => ({
        name: r.name,
        pct: Number(r.predictions_count) > 0
          ? Math.round((Number(r.exact_hits) / Number(r.predictions_count)) * 100)
          : 0
      }))
      .sort((a, b) => b.pct - a.pct)
    const sniper = sniperData[0]?.pct > 0 ? sniperData[0] : null

    // 😬 Pechowiec — najwięcej pudeł z rzędu
    const streaks = {}
    for (const row of allRows) {
      const playerPreds = allPreds
        .filter(p => p.players.name === row.name)
        .sort((a, b) => new Date(a.matches.kickoff_at) - new Date(b.matches.kickoff_at))

      let streak = 0, maxStreak = 0
      for (const p of playerPreds) {
        if ((p.points_earned || 0) === 0) {
          streak++
          maxStreak = Math.max(maxStreak, streak)
        } else {
          streak = 0
        }
      }
      streaks[row.name] = maxStreak
    }
    const unluckyEntry = Object.entries(streaks).sort((a, b) => b[1] - a[1])[0]
    const unlucky = unluckyEntry && unluckyEntry[1] >= 2
      ? { name: unluckyEntry[0], streak: unluckyEntry[1] }
      : null

    setStats({ onFire, sniper, unlucky })
    setLoading(false)
  }

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>🏆 Tabela rankingowa</h1>
        <p style={{ color: 'var(--text2)', fontSize: 14 }}>Aktualizuje się w czasie rzeczywistym</p>
      </div>

      {/* Odznaki */}
      {!loading && (stats.onFire || stats.sniper || stats.unlucky) && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
          {stats.onFire && (
            <Badge
              icon="🔥"
              title="W gazie"
              name={stats.onFire.name}
              sub={`+${stats.onFire.pts} pkt w ostatnich 24h`}
              color="#b8952a"
              bg="#b8952a12"
            />
          )}
          {stats.sniper && (
            <Badge
              icon="🎯"
              title="Snajper"
              name={stats.sniper.name}
              sub={`${stats.sniper.pct}% dokładnych wyników`}
              color="#1a7a4a"
              bg="#1a7a4a12"
            />
          )}
          {stats.unlucky && (
            <Badge
              icon="😬"
              title="Pechowiec"
              name={stats.unlucky.name}
              sub={`${stats.unlucky.streak} pudeł z rzędu`}
              color="#c0392b"
              bg="#c0392b12"
            />
          )}
        </div>
      )}

      {loading ? (
        <Skeleton />
      ) : rows.length === 0 ? (
        <Empty />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((row, i) => {
            const isMe = row.id === player?.id
            const medal = medals[i]
            const exactPct = Number(row.predictions_count) > 0
              ? Math.round((Number(row.exact_hits) / Number(row.predictions_count)) * 100)
              : 0

            return (
              <div
                key={row.id}
                className="card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 18px',
                  border: isMe ? '1px solid var(--gold)' : '1px solid #e8e0d0',
                  background: isMe ? '#b8952a08' : 'var(--bg2)',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{
                  width: 32, textAlign: 'center',
                  fontSize: medal ? 20 : 14,
                  fontWeight: 700,
                  color: medal ? undefined : 'var(--text3)',
                  fontFamily: 'Space Grotesk'
                }}>
                  {medal || i + 1}
                </div>

                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: row.avatar_color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0
                }}>
                  {row.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 600, fontSize: 15,
                    color: isMe ? 'var(--gold)' : 'var(--text)',
                    display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap'
                  }}>
                    {row.name}
                    {isMe && <span style={{ fontSize: 11, color: 'var(--gold2)', fontWeight: 400 }}>(ty)</span>}
                    {stats.onFire?.name === row.name && <span title="W gazie">🔥</span>}
                    {stats.sniper?.name === row.name && <span title="Snajper">🎯</span>}
                    {stats.unlucky?.name === row.name && <span title="Pechowiec">😬</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                    {row.predictions_count} typów
                    {Number(row.exact_hits) > 0 && ` · ${row.exact_hits}× dokładny`}
                    {exactPct > 0 && ` · ${exactPct}% skuteczność`}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ textAlign: 'center', minWidth: 36 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#1a7a4a', fontFamily: 'Space Grotesk' }}>
                      {row.exact_hits}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>cel</div>
                  </div>
                  <div style={{ textAlign: 'center', minWidth: 36 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)', fontFamily: 'Space Grotesk' }}>
                      {row.result_hits}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>1X2</div>
                  </div>
                  <div style={{
                    background: isMe ? '#b8952a18' : 'var(--bg3)',
                    borderRadius: 10, padding: '6px 14px',
                    textAlign: 'center', minWidth: 64,
                    border: isMe ? '1px solid #b8952a44' : 'none'
                  }}>
                    <div style={{
                      fontSize: 22, fontWeight: 800,
                      fontFamily: 'Space Grotesk',
                      color: isMe ? 'var(--gold)' : 'var(--text)'
                    }}>
                      {row.total_points}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>pkt</div>
                  </div>
                </div>
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

function Badge({ icon, title, name, sub, color, bg }) {
  return (
    <div style={{
      flex: 1, minWidth: 180,
      background: bg,
      border: `1px solid ${color}30`,
      borderRadius: 12,
      padding: '12px 16px',
      display: 'flex', alignItems: 'center', gap: 12
    }}>
      <div style={{ fontSize: 28, lineHeight: 1 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>
          {title}
        </div>
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
