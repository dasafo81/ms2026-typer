import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayer } from '../hooks/usePlayer'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'

export default function MyPredictionsPage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const { player } = usePlayer()

  useEffect(() => {
    if (!player) return
    load()
  }, [player])

  async function load() {
    const { data: preds } = await supabase
      .from('predictions')
      .select('*, matches(*)')
      .eq('player_id', player.id)
      .order('created_at', { ascending: false })
    setData(preds || [])
    setLoading(false)
  }

  const total = data.reduce((s, p) => s + (p.points_earned || 0), 0)
  const exact = data.filter(p => p.points_earned === 3).length
  const correct = data.filter(p => p.points_earned === 1).length
  const finished = data.filter(p => p.matches?.status === 'finished').length

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>✏️ Moje typy</h1>
        <p style={{ color: 'var(--text2)', fontSize: 14 }}>Historia wszystkich Twoich typowań</p>
      </div>

      {/* Podsumowanie */}
      {!loading && data.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: 10, marginBottom: 24
        }}>
          {[
            { label: 'Łączne punkty', value: total, color: 'var(--green)' },
            { label: 'Dokładnych', value: exact, color: 'var(--green)' },
            { label: 'Trafiony wynik', value: correct, color: 'var(--gold)' },
            { label: 'Rozegranych', value: `${finished}/${data.length}`, color: 'var(--text)' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: 'Space Grotesk' }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ color: 'var(--text2)', textAlign: 'center', padding: 40 }}>Ładowanie...</div>
      ) : data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text2)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Nie masz jeszcze żadnych typów</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Przejdź do sekcji Mecze i zacznij typować!</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.map(pred => {
            const match = pred.matches
            if (!match) return null
            const isFinished = match.status === 'finished'
            const pts = pred.points_earned

            return (
              <div key={pred.id} className="card" style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 18px', flexWrap: 'wrap'
              }}>
                {/* Data */}
                <div style={{ fontSize: 12, color: 'var(--text3)', minWidth: 90 }}>
                  {format(new Date(match.kickoff_at), 'dd MMM, HH:mm', { locale: pl })}
                </div>

                {/* Mecz */}
                <div style={{ flex: 1, minWidth: 180 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{match.home_team}</span>
                  <span style={{ color: 'var(--text3)', margin: '0 6px' }}>vs</span>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{match.away_team}</span>
                </div>

                {/* Typ */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    background: 'var(--bg3)', borderRadius: 8,
                    padding: '4px 12px', fontSize: 16, fontWeight: 700,
                    fontFamily: 'Space Grotesk'
                  }}>
                    {pred.pred_home}:{pred.pred_away}
                  </div>

                  {isFinished && (
                    <>
                      <span style={{ fontSize: 12, color: 'var(--text3)' }}>→</span>
                      <div style={{
                        background: 'var(--bg3)', borderRadius: 8,
                        padding: '4px 12px', fontSize: 16, fontWeight: 700,
                        fontFamily: 'Space Grotesk', color: 'var(--text2)'
                      }}>
                        {match.home_score}:{match.away_score}
                      </div>
                      <span className={`badge ${pts === 3 ? 'badge-green' : pts === 1 ? 'badge-gold' : 'badge-gray'}`}>
                        {pts === 3 ? '🎯 +3 pkt' : pts === 1 ? '✓ +1 pkt' : '✗ 0 pkt'}
                      </span>
                    </>
                  )}

                  {!isFinished && (
                    <span className="badge badge-blue">Oczekuje</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
