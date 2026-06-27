import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayer } from '../hooks/usePlayer'
import { useTheme } from '../hooks/useTheme'

const STAGES = ['r16', 'qf', 'sf', 'final']
const STAGE_LABELS = { r16: '1/8 finału', qf: '1/4 finału', sf: 'Półfinał', final: 'Finał' }

export default function BracketPage() {
  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState({})
  const [loading, setLoading] = useState(true)
  const { player } = usePlayer()
  const { theme } = useTheme()

  useEffect(() => {
    load()
  }, [player])

  async function load() {
    const [{ data: matchData }, { data: predData }] = await Promise.all([
      supabase.from('matches').select('*').neq('stage', 'group').order('kickoff_at'),
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

  if (loading) return <div style={{ color: theme.text2, textAlign: 'center', padding: 40 }}>Ładowanie...</div>

  const byStage = {}
  for (const s of STAGES) byStage[s] = matches.filter(m => m.stage === s)

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4, color: theme.text }}>🪜 Drabinka pucharowa</h1>
        <p style={{ color: theme.text2, fontSize: 14 }}>
          {player ? `Twoje typy — ${player.name}` : 'Wyniki turnieju'}
          <span style={{ marginLeft: 12, fontSize: 12, color: theme.text3 }}>
            <span style={{ color: '#1a7a4a' }}>■</span> trafiony awans &nbsp;
            <span style={{ color: '#c0392b' }}>■</span> chybiony &nbsp;
            <span style={{ color: theme.text3 }}>■</span> nierozegrany
          </span>
        </p>
      </div>

      {/* Desktop bracket */}
      <div style={{ overflowX: 'auto', paddingBottom: 16 }}>
        <div style={{ display: 'flex', gap: 0, minWidth: 680, alignItems: 'flex-start' }}>
          {STAGES.map((stage, si) => {
            const stageMatches = byStage[stage] || []
            const colMatches = stageMatches.length > 0 ? stageMatches : [null]

            return (
              <div key={stage} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
                  color: theme.accent, textTransform: 'uppercase',
                  textAlign: 'center', marginBottom: 12, padding: '4px 0',
                  borderBottom: `1px solid ${theme.accent}33`
                }}>
                  {STAGE_LABELS[stage]}
                </div>
                <div style={{
                  display: 'flex', flexDirection: 'column',
                  gap: stage === 'r16' ? 8 : stage === 'qf' ? 60 : stage === 'sf' ? 156 : 0,
                  padding: `${si === 0 ? 0 : si === 1 ? 30 : si === 2 ? 90 : 210}px 6px 0`
                }}>
                  {colMatches.map((match, mi) => (
                    <BracketMatch
                      key={match?.id || mi}
                      match={match}
                      prediction={match ? predictions[match.id] : null}
                      theme={theme}
                      isFinal={stage === 'final'}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Punkty pucharowe */}
      {player && (
        <div style={{
          marginTop: 24, padding: '14px 18px',
          background: theme.bg2, borderRadius: 12,
          border: `1px solid ${theme.accent}33`
        }}>
          <div style={{ fontSize: 11, color: theme.text3, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
            Twoje punkty za fazę pucharową
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {[
              { label: 'Za wyniki', key: 'points_earned' },
              { label: 'Za awans', key: 'pts_advancement' },
              { label: 'Za dogrywkę', key: 'pts_extra_time' },
              { label: 'Za karne', key: 'pts_penalty' },
            ].map(cat => {
              const total = matches.reduce((sum, m) => {
                const p = predictions[m.id]
                return sum + (p ? (p[cat.key] || 0) : 0)
              }, 0)
              return (
                <div key={cat.key}>
                  <div style={{ fontSize: 11, color: theme.text3 }}>{cat.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Space Grotesk', color: theme.accent }}>{total}</div>
                </div>
              )
            })}
            <div style={{ marginLeft: 'auto' }}>
              <div style={{ fontSize: 11, color: theme.text3 }}>Łącznie pucharowe</div>
              <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Space Grotesk', color: theme.accent }}>
                {matches.reduce((sum, m) => {
                  const p = predictions[m.id]
                  if (!p) return sum
                  return sum + (p.points_earned || 0) + (p.pts_advancement || 0) + (p.pts_extra_time || 0) + (p.pts_penalty || 0)
                }, 0)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BracketMatch({ match, prediction, theme, isFinal }) {
  if (!match) return (
    <div style={{
      background: theme.bg2, border: `1px solid ${theme.border}`,
      borderRadius: 8, padding: '8px 10px', opacity: 0.4
    }}>
      <div style={{ fontSize: 11, color: theme.text3, fontStyle: 'italic' }}>TBD</div>
      <div style={{ borderTop: `1px solid ${theme.border}`, margin: '5px 0' }} />
      <div style={{ fontSize: 11, color: theme.text3, fontStyle: 'italic' }}>TBD</div>
    </div>
  )

  const isFinished = match.status === 'finished'
  const isLive = match.status === 'live'
  const isTBD = match.home_team === 'TBD'

  const totalPts = prediction
    ? (prediction.points_earned || 0) + (prediction.pts_advancement || 0) +
      (prediction.pts_extra_time || 0) + (prediction.pts_penalty || 0)
    : 0

  function teamColor(teamName) {
    if (!isFinished || !match.winner) return theme.text
    if (teamName === match.winner) return '#1a7a4a'
    return '#c0392b'
  }

  function predColor() {
    if (!prediction?.pred_winner) return theme.text3
    if (!isFinished) return theme.accent
    return prediction.pred_winner === match.winner ? '#1a7a4a' : '#c0392b'
  }

  return (
    <div style={{
      background: theme.bg2,
      border: `1px solid ${isLive ? '#e24b4a' : isFinal ? theme.accent : theme.border}`,
      borderRadius: 8, padding: '8px 10px',
      borderLeft: isFinal ? `3px solid ${theme.accent}` : undefined,
      minWidth: 130
    }}>
      {totalPts > 0 && isFinished && (
        <div style={{
          fontSize: 9, fontWeight: 700, color: theme.accent,
          textAlign: 'right', marginBottom: 3
        }}>+{totalPts} pkt</div>
      )}

      {/* Drużyna 1 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0' }}>
        <span style={{ fontSize: 11, fontWeight: isFinished && match.winner === match.home_team ? 500 : 400, color: isTBD ? theme.text3 : teamColor(match.home_team) }}>
          {isTBD ? 'TBD' : match.home_team}
        </span>
        {(isFinished || isLive) && (
          <span style={{ fontSize: 11, fontWeight: 700, color: theme.accent, marginLeft: 6 }}>
            {match.home_score}
          </span>
        )}
      </div>

      <div style={{ borderTop: `1px solid ${theme.border}`, margin: '4px 0' }} />

      {/* Drużyna 2 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0' }}>
        <span style={{ fontSize: 11, fontWeight: isFinished && match.winner === match.away_team ? 500 : 400, color: isTBD ? theme.text3 : teamColor(match.away_team) }}>
          {isTBD ? 'TBD' : match.away_team}
        </span>
        {(isFinished || isLive) && (
          <span style={{ fontSize: 11, fontWeight: 700, color: theme.accent, marginLeft: 6 }}>
            {match.away_score}
          </span>
        )}
      </div>

      {/* Typ gracza */}
      {prediction?.pred_winner && (
        <div style={{
          marginTop: 5, paddingTop: 4,
          borderTop: `1px dashed ${theme.border}`,
          fontSize: 10, color: predColor()
        }}>
          → {prediction.pred_winner} {isFinished ? (prediction.pred_winner === match.winner ? '✓' : '✗') : '?'}
        </div>
      )}

      {/* Dodatkowe info */}
      {isFinished && (match.extra_time || match.penalty) && (
        <div style={{ fontSize: 9, color: theme.text3, marginTop: 3 }}>
          {match.extra_time && 'dogrywka'}{match.penalty && ' · karne'}
        </div>
      )}

      {isLive && (
        <div style={{ fontSize: 9, color: '#e24b4a', fontWeight: 700, marginTop: 3 }}>● LIVE</div>
      )}
    </div>
  )
}
