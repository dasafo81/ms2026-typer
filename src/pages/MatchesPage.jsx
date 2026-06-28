import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayer } from '../hooks/usePlayer'
import { useTheme } from '../hooks/useTheme'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'

const STAGE_LABELS = {
  group: 'Faza grupowa',
  r16: '1/16 finału',
  qf: '1/8 finału',
  sf: '1/4 finału',
  final: 'Finał',
  LAST_32: '1/16 finału',
  ROUND_OF_16: '1/16 finału',
  QUARTER_FINALS: '1/8 finału',
  SEMI_FINALS: '1/4 finału',
  FINAL: 'Finał'
}

export default function MatchesPage() {
  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('soon')
  const [now, setNow] = useState(new Date())
  const { player } = usePlayer()
  const { theme, knockout } = useTheme()

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

  const sorted = [...filtered].sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at))
  const useGroups = filter === 'open' || filter === 'soon'
  const groups = {}
  if (useGroups) {
    for (const m of sorted) {
      const key = m.group_name || STAGE_LABELS[m.stage] || m.stage
      if (!groups[key]) groups[key] = []
      groups[key].push(m)
    }
  }

  const btnStyle = (active) => ({
    padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
    background: active ? theme.accent : theme.bg3,
    color: active ? (knockout ? '#0f0e17' : '#000') : theme.text2,
    border: 'none', cursor: 'pointer', transition: 'all 0.15s'
  })

  return (
    <div>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4, color: theme.text }}>📅 Mecze</h1>
          <p style={{ color: theme.text2, fontSize: 14 }}>Typuj wyniki przed godziną kick-off</p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[['soon', '⏰ Najbliższe 48h'], ['open', 'Do typowania'], ['finished', 'Rozegrane'], ['all', 'Wszystkie']].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)} style={btnStyle(filter === v)}>{l}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ color: theme.text2, textAlign: 'center', padding: 40 }}>Ładowanie...</div>
      ) : sorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: theme.text2 }}>Brak meczów</div>
      ) : useGroups && Object.keys(groups).length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {Object.entries(groups).map(([groupName, groupMatches]) => (
            <div key={groupName}>
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: 1.5,
                color: theme.text3, textTransform: 'uppercase',
                marginBottom: 8, borderLeft: `3px solid ${theme.accent}`,
                paddingLeft: 10, borderRadius: 0
              }}>
                {groupName}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {groupMatches.map(match => (
                  <MatchCard key={match.id} match={match} prediction={predictions[match.id]}
                    playerId={player?.id} onSaved={loadAll} theme={theme} knockout={knockout} now={now} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sorted.map(match => (
            <MatchCard key={match.id} match={match} prediction={predictions[match.id]}
              playerId={player?.id} onSaved={loadAll} theme={theme} knockout={knockout} now={now} />
          ))}
        </div>
      )}
    </div>
  )
}

function MatchCard({ match, prediction, playerId, onSaved, theme, knockout, now }) {
  const kickoff = new Date(match.kickoff_at)
  const isOpen = match.status === 'scheduled' && kickoff > now
  const isLive = match.status === 'live'
  const isFinished = match.status === 'finished'
  const isKnockout = match.stage !== 'group'

  const [home, setHome] = useState(prediction?.pred_home ?? '')
  const [away, setAway] = useState(prediction?.pred_away ?? '')
  const [extraTime, setExtraTime] = useState(prediction?.pred_extra_time ?? false)
  const [penalty, setPenalty] = useState(prediction?.pred_penalty ?? false)
  const [winner, setWinner] = useState(prediction?.pred_winner ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const showKnockoutOptions = isKnockout && isOpen
  const showDrawOptions = isKnockout && isOpen && home !== '' && away !== '' && parseInt(home) === parseInt(away)

  async function savePrediction() {
    if (!playerId || home === '' || away === '') return
    setSaving(true)
    const payload = {
      player_id: playerId,
      match_id: match.id,
      pred_home: parseInt(home),
      pred_away: parseInt(away),
      points_earned: 0,
      pts_advancement: 0,
      pts_extra_time: 0,
      pts_penalty: 0,
      pts_winner: 0,
    }
    if (isKnockout) {
      payload.pred_extra_time = extraTime
      payload.pred_penalty = penalty
      payload.pred_winner = winner || null
    }
    await supabase.from('predictions').upsert(payload, { onConflict: 'player_id,match_id' })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    onSaved()
  }

  const totalPts = (prediction?.points_earned || 0) + (prediction?.pts_advancement || 0) +
    (prediction?.pts_extra_time || 0) + (prediction?.pts_penalty || 0) + (prediction?.pts_winner || 0)

  const cardStyle = {
    background: theme.bg2,
    border: `1px solid ${isLive ? '#e24b4a' : theme.border}`,
    borderRadius: 12,
    padding: '14px 18px',
    ...(isKnockout && { borderLeft: `3px solid ${theme.accent}` })
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {/* Status */}
        <div style={{ minWidth: 80 }}>
          {isKnockout && (
            <div style={{ fontSize: 9, fontWeight: 700, color: theme.accent, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>
              {STAGE_LABELS[match.stage] || match.stage}
            </div>
          )}
          {isLive && <span style={{ fontSize: 11, color: '#e24b4a', fontWeight: 700 }}>● LIVE</span>}
          {isFinished && <span style={{ fontSize: 11, color: theme.text3 }}>Zakończony</span>}
          {isOpen && <span style={{ fontSize: 11, color: theme.text2 }}>{format(kickoff, 'dd.MM HH:mm', { locale: pl })}</span>}
        </div>

        {/* Mecz */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', minWidth: 200 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: theme.text, textAlign: 'right', minWidth: 80 }}>
            {match.home_flag} {match.home_team}
          </span>

          {isFinished || isLive ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: theme.bg3, borderRadius: 8, padding: '6px 14px' }}>
              <span style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Space Grotesk', color: theme.text }}>{match.home_score ?? '–'}</span>
              <span style={{ color: theme.text3, fontSize: 14 }}>:</span>
              <span style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Space Grotesk', color: theme.text }}>{match.away_score ?? '–'}</span>
              {match.penalty && <span style={{ fontSize: 10, color: '#e24b4a', marginLeft: 4 }}>k</span>}
              {match.extra_time && !match.penalty && <span style={{ fontSize: 10, color: theme.accent, marginLeft: 4 }}>d</span>}
            </div>
          ) : (
            <div style={{ color: theme.text3, fontSize: 20, fontWeight: 700 }}>vs</div>
          )}

          <span style={{ fontSize: 14, fontWeight: 600, color: theme.text, minWidth: 80 }}>
            {match.away_team} {match.away_flag}
          </span>
        </div>

        {/* Typ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 160, justifyContent: 'flex-end' }}>
          {isOpen ? (
            <>
              <input className="score-input" type="number" min="0" max="20" value={home}
                onChange={e => setHome(e.target.value)} placeholder="–"
                style={{ background: theme.bg3, borderColor: theme.border2, color: theme.text }} />
              <span style={{ color: theme.text3, fontSize: 14 }}>:</span>
              <input className="score-input" type="number" min="0" max="20" value={away}
                onChange={e => setAway(e.target.value)} placeholder="–"
                style={{ background: theme.bg3, borderColor: theme.border2, color: theme.text }} />
              <button onClick={savePrediction} disabled={saving || home === '' || away === ''}
                style={{
                  padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: saved ? `${theme.accent}22` : theme.accent,
                  color: saved ? theme.accent : (knockout ? '#0f0e17' : '#000'),
                  border: saved ? `1px solid ${theme.accent}` : 'none',
                  cursor: 'pointer', transition: 'all 0.15s', opacity: saving ? 0.6 : 1
                }}>
                {saved ? '✓' : saving ? '...' : 'Zapisz'}
              </button>
            </>
          ) : prediction ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <span style={{ color: theme.text2, fontSize: 13 }}>
                Typ: <strong style={{ color: theme.text }}>{prediction.pred_home}:{prediction.pred_away}</strong>
              </span>
              {isFinished && (
                <span style={{
                  padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                  background: totalPts >= 3 ? '#1a7a4a20' : totalPts > 0 ? `${theme.accent}20` : theme.bg3,
                  color: totalPts >= 3 ? '#1a7a4a' : totalPts > 0 ? theme.accent : theme.text3
                }}>
                  {totalPts > 0 ? `+${totalPts} pkt` : '0 pkt'}
                </span>
              )}
            </div>
          ) : !isOpen && (
            <span style={{ fontSize: 12, color: theme.text3 }}>Nie typowałeś</span>
          )}
        </div>
      </div>

      {/* Opcje pucharowe — przy remisie po 90 min */}
      {showKnockoutOptions && (
        <div style={{
          marginTop: 12, padding: '10px 14px',
          background: theme.bg3, borderRadius: 8,
          border: `1px solid ${theme.accent}33`
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: theme.accent, letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>
            Opcje pucharowe
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: theme.text2 }}>Awansuje (+2 pkt):</span>
              <select value={winner} onChange={e => setWinner(e.target.value)}
                style={{ background: theme.bg2, color: theme.text, border: `1px solid ${theme.border2}`, borderRadius: 6, padding: '4px 8px', fontSize: 13 }}>
                <option value="">— wybierz —</option>
                <option value={match.home_team}>{match.home_team}</option>
                <option value={match.away_team}>{match.away_team}</option>
              </select>
            </div>
            {showDrawOptions && (
              <>
                <label style={{ fontSize: 13, color: theme.text2, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={extraTime} onChange={e => { setExtraTime(e.target.checked); if (!e.target.checked) setPenalty(false) }}
                    style={{ accentColor: theme.accent }} />
                  Dogrywka (+1 pkt)
                </label>
                {extraTime && (
                  <label style={{ fontSize: 13, color: theme.text2, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="checkbox" checked={penalty} onChange={e => setPenalty(e.target.checked)}
                      style={{ accentColor: theme.accent }} />
                    Karne (+1 pkt)
                  </label>
                )}
              </>
            )}
          </div>
          {!showDrawOptions && (
            <div style={{ fontSize: 11, color: theme.text3, marginTop: 6 }}>
              Wpisz remis żeby odblokować opcje dogrywki i karnych
            </div>
          )}
        </div>
      )}

      {/* Podsumowanie typów pucharowych — po zamknięciu */}
      {isFinished && prediction && isKnockout && (
        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {prediction.pred_winner && (
            <span style={{ fontSize: 11, color: theme.text3 }}>
              Awans: <span style={{ color: prediction.pts_advancement > 0 ? '#1a7a4a' : '#c0392b' }}>
                {prediction.pred_winner} {prediction.pts_advancement > 0 ? '✓' : '✗'}
              </span>
            </span>
          )}
          {prediction.pred_extra_time !== null && prediction.pred_extra_time !== undefined && (
            <span style={{ fontSize: 11, color: theme.text3 }}>
              Dogrywka: <span style={{ color: prediction.pts_extra_time > 0 ? '#1a7a4a' : '#c0392b' }}>
                {prediction.pred_extra_time ? 'Tak' : 'Nie'} {prediction.pts_extra_time > 0 ? '✓' : '✗'}
              </span>
            </span>
          )}
        </div>
      )}
    </div>
  )
}
