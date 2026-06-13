import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayer } from '../hooks/usePlayer'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'

export default function MatchesPage() {
  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState({}) // match_id -> prediction
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [now, setNow] = useState(new Date())
  const { player } = usePlayer()

  useEffect(() => {
    loadAll()
    const tick = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(tick)
  }, [player])

  async function loadAll() {
    const [{ data: matchData }, { data: predData }] = await Promise.all([
      supabase.from('matches').select('*').order('kickoff_at', { ascending: true }),
      player
        ? supabase.from('predictions').select('*').eq('player_id', player.id)
        : Promise.resolve({ data: [] })
    ])

    setMatches(matchData || [])
    const predMap = {}
    for (const p of predData || []) predMap[p.match_id] = p
    setPredictions(predMap)
    setLoading(false)
  }

  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000)
  const filtered = matches.filter(m => {
    if (filter === 'open') return m.status === 'scheduled' && new Date(m.kickoff_at) > now
    if (filter === 'soon') return m.status === 'scheduled' && new Date(m.kickoff_at) > now && new Date(m.kickoff_at) <= in48h
    if (filter === 'finished') return m.status === 'finished'
    return true
  })

  // Sortuj chronologicznie
  const sorted = [...filtered].sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at))

  // Grupuj po group_name tylko dla filtra 'open' i 'soon', reszta płasko
  const useGroups = filter === 'open' || filter === 'soon'
  const groups = {}
  if (useGroups) {
    for (const m of sorted) {
      const key = m.group_name || m.stage || 'Inne'
      if (!groups[key]) groups[key] = []
      groups[key].push(m)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>📅 Mecze</h1>
          <p style={{ color: 'var(--text2)', fontSize: 14 }}>Typuj wyniki przed godziną kick-off</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['all', 'Wszystkie'], ['soon', '⏰ Najbliższe 48h'], ['open', 'Do typowania'], ['finished', 'Rozegrane']].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                background: filter === v ? 'var(--green)' : 'var(--bg3)',
                color: filter === v ? '#000' : 'var(--text2)',
                border: 'none', cursor: 'pointer', transition: 'all 0.15s'
              }}
            >{l}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text2)', textAlign: 'center', padding: 40 }}>Ładowanie...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text2)' }}>Brak meczów</div>
      ) : useGroups && Object.keys(groups).length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {Object.entries(groups).map(([groupName, groupMatches]) => (
            <div key={groupName}>
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: 1.5,
                color: 'var(--text3)', textTransform: 'uppercase',
                marginBottom: 8, paddingLeft: 2,
                borderLeft: '3px solid var(--gold)',
                paddingLeft: 10
              }}>
                {groupName}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {groupMatches.map(match => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    prediction={predictions[match.id]}
                    playerId={player?.id}
                    onSaved={loadAll}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sorted.map(match => (
            <MatchCard
              key={match.id}
              match={match}
              prediction={predictions[match.id]}
              playerId={player?.id}
              onSaved={loadAll}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function MatchCard({ match, prediction, playerId, onSaved }) {
  const now = new Date()
  const kickoff = new Date(match.kickoff_at)
  const isOpen = match.status === 'scheduled' && kickoff > now
  const isLive = match.status === 'live'
  const isFinished = match.status === 'finished'

  const [home, setHome] = useState(prediction?.pred_home ?? '')
  const [away, setAway] = useState(prediction?.pred_away ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function savePrediction() {
    if (!playerId || home === '' || away === '') return
    setSaving(true)
    await supabase.from('predictions').upsert({
      player_id: playerId,
      match_id: match.id,
      pred_home: parseInt(home),
      pred_away: parseInt(away),
      points_earned: 0
    }, { onConflict: 'player_id,match_id' })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    onSaved()
  }

  const pts = prediction?.points_earned

  return (
    <div className="card" style={{
      padding: '14px 18px',
      border: `1px solid ${isLive ? 'var(--red)' : prediction ? 'var(--border2)' : 'var(--border)'}`,
      background: isLive ? '#1a0a0a' : 'var(--bg2)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {/* Status */}
        <div style={{ minWidth: 70 }}>
          {isLive && <span className="tag-live">LIVE</span>}
          {isFinished && (
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>Wynik końcowy</span>
          )}
          {isOpen && (
            <span style={{ fontSize: 11, color: 'var(--text2)' }}>
              {format(kickoff, 'dd.MM HH:mm', { locale: pl })}
            </span>
          )}
        </div>

        {/* Mecz */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 10,
          justifyContent: 'center', minWidth: 200
        }}>
          <TeamLabel name={match.home_team} flag={match.home_flag} align="right" />

          {isFinished || isLive ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--bg3)', borderRadius: 8,
              padding: '6px 14px'
            }}>
              <span style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Space Grotesk' }}>
                {match.home_score ?? '–'}
              </span>
              <span style={{ color: 'var(--text3)', fontSize: 14 }}>:</span>
              <span style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Space Grotesk' }}>
                {match.away_score ?? '–'}
              </span>
            </div>
          ) : (
            <div style={{ color: 'var(--text3)', fontSize: 20, fontWeight: 700 }}>vs</div>
          )}

          <TeamLabel name={match.away_team} flag={match.away_flag} align="left" />
        </div>

        {/* Typ gracza */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 150, justifyContent: 'flex-end' }}>
          {isOpen ? (
            <>
              <input
                className="score-input"
                type="number" min="0" max="20"
                value={home}
                onChange={e => setHome(e.target.value)}
                placeholder="–"
              />
              <span style={{ color: 'var(--text3)', fontSize: 14 }}>:</span>
              <input
                className="score-input"
                type="number" min="0" max="20"
                value={away}
                onChange={e => setAway(e.target.value)}
                placeholder="–"
              />
              <button
                onClick={savePrediction}
                disabled={saving || home === '' || away === ''}
                style={{
                  padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: saved ? 'var(--green-dim)' : 'var(--green)',
                  color: saved ? 'var(--green)' : '#000',
                  border: saved ? '1px solid var(--green)' : 'none',
                  cursor: 'pointer', transition: 'all 0.15s',
                  opacity: saving ? 0.6 : 1
                }}
              >
                {saved ? '✓' : saving ? '...' : 'Zapisz'}
              </button>
            </>
          ) : prediction ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--text2)', fontSize: 13 }}>
                Twój typ: <strong>{prediction.pred_home}:{prediction.pred_away}</strong>
              </span>
              {isFinished && pts !== undefined && (
                <span className={`badge ${pts === 3 ? 'badge-green' : pts === 1 ? 'badge-gold' : 'badge-gray'}`}>
                  {pts === 3 ? '+3 pkt' : pts === 1 ? '+1 pkt' : '0 pkt'}
                </span>
              )}
            </div>
          ) : !isOpen && (
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>Nie typowałeś</span>
          )}
        </div>
      </div>
    </div>
  )
}

function TeamLabel({ name, flag, align }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: align === 'right' ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
      minWidth: 90,
      textAlign: align
    }}>
      {flag && <span style={{ fontSize: 20 }}>{flag}</span>}
      <span style={{ fontSize: 14, fontWeight: 600 }}>{name}</span>
    </div>
  )
}
