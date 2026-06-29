import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayer } from '../hooks/usePlayer'
import { useTheme } from '../hooks/useTheme'

const STAGES = ['r32', 'r16', 'qf', 'sf', 'final']
const STAGE_LABELS = {
  r32: '1/16 finału',
  r16: '1/8 finału',
  qf: '1/4 finału',
  sf: '1/2 finału',
  final: 'Finał'
}

// Wymiary karty i kolumny
const CARD_H = 72      // wysokość karty meczu (px)
const CARD_W = 168     // szerokość karty — wystarczy dla "South Africa"
const COL_GAP = 36     // odstęp między kolumnami (miejsce na linie)
const COL_W = CARD_W + COL_GAP

// Dla każdej rundy: ile meczów i jaki pionowy odstęp między kartami
function stageLayout(si) {
  const count = Math.pow(2, 4 - si)  // r32=16, r16=8, qf=4, sf=2, final=1
  // Każda następna runda ma dwukrotnie większy skok między kartami
  const slot = CARD_H * Math.pow(2, si)  // wysokość "slotu" na jedną kartę
  const topOffset = (slot - CARD_H) / 2  // wycentrowanie karty w slocie
  return { count, slot, topOffset }
}

export default function BracketPage() {
  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState({})
  const [loading, setLoading] = useState(true)
  const { player } = usePlayer()
  const { theme } = useTheme()

  useEffect(() => { load() }, [player])

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

  // Całkowita wysokość SVG = 16 slotów × CARD_H (runda r32 wyznacza wysokość)
  const totalH = 16 * CARD_H
  const totalW = STAGES.length * COL_W - COL_GAP + 16  // +16 margines prawa

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

      <div style={{ overflowX: 'auto', paddingBottom: 20 }}>
        <div style={{ position: 'relative', width: totalW, height: totalH, minWidth: totalW }}>
          {/* SVG linie łączące */}
          <svg
            width={totalW}
            height={totalH}
            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 0 }}
          >
            {STAGES.slice(0, -1).map((stage, si) => {
              const { count, slot, topOffset } = stageLayout(si)
              const nextSlot = slot * 2
              const lines = []
              const x1 = si * COL_W + CARD_W          // prawy bok obecnej kolumny
              const x2 = (si + 1) * COL_W              // lewy bok następnej kolumny

              for (let i = 0; i < count; i += 2) {
                const y1 = i * slot + topOffset + CARD_H / 2
                const y2 = (i + 1) * slot + topOffset + CARD_H / 2
                const yMid = (y1 + y2) / 2
                const xMid = (x1 + x2) / 2

                lines.push(
                  <g key={`${si}-${i}`}>
                    {/* linia z karty górnej */}
                    <path
                      d={`M ${x1} ${y1} H ${xMid} V ${yMid}`}
                      fill="none" stroke={theme.accent + '55'} strokeWidth={1.5}
                    />
                    {/* linia z karty dolnej */}
                    <path
                      d={`M ${x1} ${y2} H ${xMid} V ${yMid}`}
                      fill="none" stroke={theme.accent + '55'} strokeWidth={1.5}
                    />
                    {/* linia do następnej kolumny */}
                    <path
                      d={`M ${xMid} ${yMid} H ${x2}`}
                      fill="none" stroke={theme.accent + '55'} strokeWidth={1.5}
                    />
                  </g>
                )
              }
              return lines
            })}
          </svg>

          {/* Karty meczów */}
          {STAGES.map((stage, si) => {
            const { count, slot, topOffset } = stageLayout(si)
            const stageMatches = byStage[stage] || []
            const x = si * COL_W

            return (
              <div key={stage} style={{ position: 'absolute', left: x, top: 0, width: CARD_W }}>
                {/* Nagłówek rundy */}
                <div style={{
                  position: 'absolute',
                  top: -28, left: 0, width: CARD_W,
                  fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
                  color: theme.accent, textTransform: 'uppercase', textAlign: 'center'
                }}>
                  {STAGE_LABELS[stage]}
                </div>

                {Array.from({ length: count }).map((_, i) => {
                  const match = stageMatches[i] || null
                  const pred = match ? predictions[match.id] : null
                  const top = i * slot + topOffset

                  return (
                    <div
                      key={i}
                      style={{ position: 'absolute', top, left: 0, width: CARD_W, zIndex: 1 }}
                    >
                      <BracketCard match={match} prediction={pred} theme={theme} isFinal={stage === 'final'} />
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* Etykiety rund pod drabinką (dla czytelności na małych ekranach) */}
      <div style={{ display: 'flex', gap: 0, marginTop: 8, overflowX: 'auto' }}>
        {STAGES.map(s => (
          <div key={s} style={{ width: COL_W, flexShrink: 0, textAlign: 'center', fontSize: 10, color: theme.text3 }}>
            {stageLayout(STAGES.indexOf(s)).count} meczów
          </div>
        ))}
      </div>

      {/* Punkty pucharowe gracza */}
      {player && (() => {
        const kMatches = matches
        const totalByKey = (key) => kMatches.reduce((s, m) => s + ((predictions[m.id]?.[key]) || 0), 0)
        const grand = totalByKey('points_earned') + totalByKey('pts_advancement') + totalByKey('pts_extra_time') + totalByKey('pts_penalty')
        return (
          <div style={{
            marginTop: 28, padding: '14px 18px',
            background: theme.bg2, borderRadius: 12,
            border: `1px solid ${theme.accent}33`
          }}>
            <div style={{ fontSize: 11, color: theme.text3, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
              Twoje punkty za fazę pucharową
            </div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              {[
                { label: 'Za wyniki', key: 'points_earned' },
                { label: 'Za awans', key: 'pts_advancement' },
                { label: 'Za dogrywkę', key: 'pts_extra_time' },
                { label: 'Za karne', key: 'pts_penalty' },
              ].map(cat => (
                <div key={cat.key}>
                  <div style={{ fontSize: 11, color: theme.text3 }}>{cat.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Space Grotesk', color: theme.accent }}>
                    {totalByKey(cat.key)}
                  </div>
                </div>
              ))}
              <div style={{ marginLeft: 'auto' }}>
                <div style={{ fontSize: 11, color: theme.text3 }}>Łącznie pucharowe</div>
                <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Space Grotesk', color: theme.accent }}>
                  {grand}
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function BracketCard({ match, prediction, theme, isFinal }) {
  const isEmpty = !match || match.home_team === 'TBD'
  const isFinished = match?.status === 'finished'
  const isLive = match?.status === 'live'

  const totalPts = prediction
    ? (prediction.points_earned || 0) + (prediction.pts_advancement || 0)
      + (prediction.pts_extra_time || 0) + (prediction.pts_penalty || 0)
    : 0

  function teamColor(name) {
    if (!isFinished || !match?.winner) return theme.text
    return name === match.winner ? '#1a7a4a' : '#c0392b'
  }

  function predColor() {
    if (!prediction?.pred_winner) return theme.text3
    if (!isFinished) return theme.accent
    return prediction.pred_winner === match?.winner ? '#1a7a4a' : '#c0392b'
  }

  if (isEmpty) {
    return (
      <div style={{
        height: CARD_H, background: theme.bg2,
        border: `1px solid ${theme.border}`,
        borderRadius: 8, overflow: 'hidden',
        opacity: 0.45, boxSizing: 'border-box'
      }}>
        <div style={{ padding: '10px 10px 6px', fontSize: 11, color: theme.text3, fontStyle: 'italic' }}>TBD</div>
        <div style={{ borderTop: `1px solid ${theme.border}` }} />
        <div style={{ padding: '6px 10px', fontSize: 11, color: theme.text3, fontStyle: 'italic' }}>TBD</div>
      </div>
    )
  }

  return (
    <div style={{
      height: CARD_H,
      background: theme.bg2,
      border: `1px solid ${isLive ? '#e24b4a' : isFinal ? theme.accent : theme.border}`,
      borderRadius: 8,
      borderLeft: isFinal ? `3px solid ${theme.accent}` : undefined,
      overflow: 'hidden',
      boxSizing: 'border-box',
      position: 'relative'
    }}>
      {/* punkty badge */}
      {totalPts > 0 && isFinished && (
        <div style={{ position: 'absolute', top: 2, right: 5, fontSize: 9, fontWeight: 700, color: theme.accent }}>
          +{totalPts}
        </div>
      )}
      {isLive && (
        <div style={{ position: 'absolute', top: 2, left: 5, fontSize: 8, color: '#e24b4a', fontWeight: 700 }}>● LIVE</div>
      )}

      {/* Drużyna 1 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0 8px', height: prediction?.pred_winner ? '40%' : '50%',
        boxSizing: 'border-box'
      }}>
        <span style={{
          fontSize: 11, fontWeight: isFinished && match.winner === match.home_team ? 700 : 400,
          color: teamColor(match.home_team),
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0
        }}>
          {match.home_team}
        </span>
        {(isFinished || isLive) && (
          <span style={{ fontSize: 12, fontWeight: 800, color: theme.accent, marginLeft: 6, flexShrink: 0 }}>
            {match.home_score}
          </span>
        )}
      </div>

      <div style={{ borderTop: `1px solid ${theme.border}` }} />

      {/* Drużyna 2 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0 8px', height: prediction?.pred_winner ? '40%' : '50%',
        boxSizing: 'border-box'
      }}>
        <span style={{
          fontSize: 11, fontWeight: isFinished && match.winner === match.away_team ? 700 : 400,
          color: teamColor(match.away_team),
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0
        }}>
          {match.away_team}
        </span>
        {(isFinished || isLive) && (
          <span style={{ fontSize: 12, fontWeight: 800, color: theme.accent, marginLeft: 6, flexShrink: 0 }}>
            {match.away_score}
          </span>
        )}
      </div>

      {/* Typ gracza */}
      {prediction?.pred_winner && (
        <div style={{
          height: '20%', display: 'flex', alignItems: 'center',
          padding: '0 8px', boxSizing: 'border-box',
          borderTop: `1px dashed ${theme.border}`,
          background: predColor() === '#1a7a4a' ? '#1a7a4a10' : predColor() === '#c0392b' ? '#c0392b08' : 'transparent',
          fontSize: 10, color: predColor(),
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
        }}>
          → {prediction.pred_winner} {isFinished ? (prediction.pred_winner === match.winner ? '✓' : '✗') : '?'}
        </div>
      )}
    </div>
  )
}
