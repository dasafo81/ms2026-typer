import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayer } from '../hooks/usePlayer'

export default function LeaderboardPage() {
  const [rows, setRows] = useState([])
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
    const { data } = await supabase.from('leaderboard').select('*')
    setRows(data || [])
    setLoading(false)
  }

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>🏆 Tabela rankingowa</h1>
        <p style={{ color: 'var(--text2)', fontSize: 14 }}>Aktualizuje się w czasie rzeczywistym</p>
      </div>

      {loading ? (
        <Skeleton />
      ) : rows.length === 0 ? (
        <Empty />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((row, i) => {
            const isMe = row.id === player?.id
            const medal = medals[i]

            return (
              <div
                key={row.id}
                className="card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 18px',
                  border: isMe
                    ? '1px solid var(--green)'
                    : '1px solid var(--border)',
                  background: isMe ? 'var(--green-dim)' : 'var(--bg2)',
                  transition: 'all 0.2s'
                }}
              >
                {/* Pozycja */}
                <div style={{
                  width: 32, textAlign: 'center',
                  fontSize: medal ? 20 : 14,
                  fontWeight: 700,
                  color: medal ? undefined : 'var(--text3)',
                  fontFamily: 'Space Grotesk'
                }}>
                  {medal || i + 1}
                </div>

                {/* Avatar */}
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: row.avatar_color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700, color: '#fff',
                  flexShrink: 0
                }}>
                  {row.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                </div>

                {/* Imię */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 600, fontSize: 15,
                    color: isMe ? 'var(--green)' : 'var(--text)',
                    display: 'flex', alignItems: 'center', gap: 6
                  }}>
                    {row.name}
                    {isMe && <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 400 }}>(ty)</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                    {row.predictions_count} typów
                    {row.exact_hits > 0 && ` · ${row.exact_hits}× dokładny wynik`}
                  </div>
                </div>

                {/* Statki */}
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <Stat label="dokładnych" value={row.exact_hits} color="var(--green)" />
                  <Stat label="1X2" value={row.result_hits} color="var(--gold)" />
                  <div style={{
                    background: 'var(--bg3)',
                    borderRadius: 10,
                    padding: '6px 14px',
                    textAlign: 'center',
                    minWidth: 64
                  }}>
                    <div style={{
                      fontSize: 22, fontWeight: 800,
                      fontFamily: 'Space Grotesk',
                      color: isMe ? 'var(--green)' : 'var(--text)'
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

      {/* Stats bar */}
      {rows.length > 0 && (
        <div style={{
          marginTop: 20,
          display: 'flex', gap: 12, flexWrap: 'wrap'
        }}>
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

function Stat({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center', display: 'none' }} className="stat-wide">
      <div style={{ fontSize: 16, fontWeight: 700, color, fontFamily: 'Space Grotesk' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text3)' }}>{label}</div>
    </div>
  )
}

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="card" style={{
          height: 68, opacity: 0.4,
          background: 'var(--bg3)',
          animation: 'pulse 1.5s ease-in-out infinite'
        }} />
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
