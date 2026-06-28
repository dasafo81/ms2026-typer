import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayer } from '../hooks/usePlayer'
import { useTheme } from '../hooks/useTheme'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'

export default function MyPredictionsPage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const { player } = usePlayer()
  const { theme: t } = useTheme()

  useEffect(() => { if (!player) return; load() }, [player])

  async function load() {
    const { data: preds } = await supabase.from('predictions').select('*, matches(*)').eq('player_id', player.id).order('created_at', { ascending: false })
    setData(preds || [])
    setLoading(false)
  }

  const total = data.reduce((s, p) => s + (p.points_earned || 0) + (p.pts_advancement || 0) + (p.pts_extra_time || 0) + (p.pts_penalty || 0), 0)
  const exact = data.filter(p => p.points_earned === 3).length
  const correct = data.filter(p => p.points_earned === 1).length
  const finished = data.filter(p => p.matches?.status === 'finished').length

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4, color: t.text }}>✏️ Moje typy</h1>
        <p style={{ color: t.text2, fontSize: 14 }}>Historia wszystkich Twoich typowań</p>
      </div>
      {!loading && data.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 24 }}>
          {[{ label: 'Łączne punkty', value: total, color: t.accent }, { label: 'Dokładnych', value: exact, color: '#1a7a4a' }, { label: 'Trafiony wynik', value: correct, color: t.accent }, { label: 'Rozegranych', value: `${finished}/${data.length}`, color: t.text }].map(s => (
            <div key={s.label} style={{ padding: '12px 16px', background: t.bg2, border: `1px solid ${t.border || '#e8e0d0'}`, borderRadius: 12 }}>
              <div style={{ fontSize: 11, color: t.text2, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: 'Space Grotesk' }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}
      {loading ? <div style={{ color: t.text2, textAlign: 'center', padding: 40 }}>Ładowanie...</div> : data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: t.text2 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Nie masz jeszcze żadnych typów</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.map(pred => {
            const match = pred.matches
            if (!match) return null
            const isFinished = match.status === 'finished'
            const totalPts = (pred.points_earned || 0) + (pred.pts_advancement || 0) + (pred.pts_extra_time || 0) + (pred.pts_penalty || 0)
            return (
              <div key={pred.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px', flexWrap: 'wrap', background: t.bg2, border: `1px solid ${t.border || '#e8e0d0'}`, borderRadius: 12 }}>
                <div style={{ fontSize: 12, color: t.text3, minWidth: 90 }}>{format(new Date(match.kickoff_at), 'dd MMM, HH:mm', { locale: pl })}</div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: t.text }}>{match.home_team}</span>
                  <span style={{ color: t.text3, margin: '0 6px' }}>vs</span>
                  <span style={{ fontWeight: 600, fontSize: 14, color: t.text }}>{match.away_team}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ background: t.bg3, borderRadius: 8, padding: '4px 12px', fontSize: 16, fontWeight: 700, fontFamily: 'Space Grotesk', color: t.text }}>
                    {pred.pred_home}:{pred.pred_away}
                  </div>
                  {isFinished && (
                    <>
                      <span style={{ fontSize: 12, color: t.text3 }}>→</span>
                      <div style={{ background: t.bg3, borderRadius: 8, padding: '4px 12px', fontSize: 16, fontWeight: 700, fontFamily: 'Space Grotesk', color: t.text2 }}>
                        {match.home_score}:{match.away_score}
                      </div>
                      <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: totalPts >= 3 ? '#1a7a4a20' : totalPts > 0 ? `${t.accent}20` : t.bg3, color: totalPts >= 3 ? '#1a7a4a' : totalPts > 0 ? t.accent : t.text3 }}>
                        {totalPts > 0 ? `+${totalPts} pkt` : '0 pkt'}
                      </span>
                    </>
                  )}
                  {!isFinished && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                      <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#1565c015', color: '#1565c0' }}>Oczekuje</span>
                      {match.stage !== 'group' && (
                        <div style={{ fontSize: 10, color: t.text3, display: 'flex', gap: 6 }}>
                          {pred.pred_winner && <span style={{ color: t.accent }}>→ {pred.pred_winner}</span>}
                          {pred.pred_extra_time && <span>· dogrywka</span>}
                          {pred.pred_penalty && <span>· karne</span>}
                        </div>
                      )}
                    </div>
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
