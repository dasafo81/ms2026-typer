import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fetchFixtures, fetchLiveFixtures, mapFixtureToMatch } from '../lib/apiFootball'
import { usePlayer } from '../hooks/usePlayer'
import { useNavigate } from 'react-router-dom'

const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASSWORD || 'typer2026'

export default function AdminPage() {
  const { player } = usePlayer()
  const navigate = useNavigate()
  const [authed, setAuthed] = useState(false)
  const [pass, setPass] = useState('')
  const [matches, setMatches] = useState([])
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [log, setLog] = useState([])
  const [players, setPlayers] = useState([])
  const [calcMatch, setCalcMatch] = useState('')

  useEffect(() => {
    if (authed) { loadMatches(); loadPlayers(); loadLog() }
  }, [authed])

  async function loadMatches() {
    const { data } = await supabase.from('matches').select('*').order('kickoff_at')
    setMatches(data || [])
  }

  async function loadPlayers() {
    const { data } = await supabase.from('players').select('*').order('name')
    setPlayers(data || [])
  }

  async function loadLog() {
    const { data } = await supabase.from('sync_log').select('*').order('synced_at', { ascending: false }).limit(10)
    setLog(data || [])
  }

  async function syncFromAPI(liveOnly = false) {
    setSyncing(true)
    setSyncResult(null)
    try {
      const fixtures = liveOnly ? await fetchLiveFixtures() : await fetchFixtures()
      let updated = 0

      for (const fixture of fixtures) {
        const mapped = mapFixtureToMatch(fixture)
        const { error } = await supabase.from('matches').upsert(mapped, { onConflict: 'api_match_id' })
        if (!error) updated++

        // Jeśli mecz zakończony — przelicz punkty
        if (mapped.status === 'finished') {
          const { data: match } = await supabase
            .from('matches').select('id').eq('api_match_id', mapped.api_match_id).single()
          if (match) {
            await supabase.rpc('calculate_points', { p_match_id: match.id })
          }
        }
      }

      await supabase.from('sync_log').insert({ matches_updated: updated, notes: liveOnly ? 'Live sync' : 'Full sync' })
      setSyncResult({ ok: true, msg: `Zaktualizowano ${updated} meczów` })
      await loadMatches()
      await loadLog()
    } catch (err) {
      setSyncResult({ ok: false, msg: err.message })
    } finally {
      setSyncing(false)
    }
  }

  async function calcPoints(matchId) {
    await supabase.rpc('calculate_points', { p_match_id: matchId })
    setSyncResult({ ok: true, msg: 'Punkty przeliczone' })
  }

  async function toggleAdmin(pid, current) {
    await supabase.from('players').update({ is_admin: !current }).eq('id', pid)
    await loadPlayers()
  }

  async function deletePlayer(pid, name) {
    if (!confirm(`Usunąć gracza "${name}" i wszystkie jego typy?`)) return
    await supabase.from('predictions').delete().eq('player_id', pid)
    await supabase.from('players').delete().eq('id', pid)
    await loadPlayers()
  }

  async function updateScore(matchId, field, value) {
    await supabase.from('matches').update({ [field]: parseInt(value) || 0, status: 'finished' }).eq('id', matchId)
    await supabase.rpc('calculate_points', { p_match_id: matchId })
    await loadMatches()
  }

  if (!authed) {
    return (
      <div style={{ maxWidth: 360, margin: '60px auto' }}>
        <div className="card" style={{ padding: 28 }}>
          <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 18, marginBottom: 20 }}>⚙️ Panel admina</h2>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>Hasło admina</label>
            <input
              className="input-field"
              type="password"
              value={pass}
              onChange={e => setPass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && pass === ADMIN_PASS && setAuthed(true)}
              placeholder="••••••••"
            />
          </div>
          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => pass === ADMIN_PASS ? setAuthed(true) : alert('Złe hasło')}
          >
            Wejdź
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>⚙️ Panel admina</h1>
      </div>

      {syncResult && (
        <div style={{
          background: syncResult.ok ? 'var(--green-dim)' : 'var(--red-dim)',
          border: `1px solid ${syncResult.ok ? 'var(--green)' : 'var(--red)'}`,
          borderRadius: 10, padding: '10px 16px', marginBottom: 16,
          color: syncResult.ok ? 'var(--green)' : 'var(--red)', fontSize: 14
        }}>
          {syncResult.ok ? '✓' : '✗'} {syncResult.msg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
        {/* Sync */}
        <div className="card">
          <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 15, marginBottom: 14 }}>🔄 Sync z API-Football</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              className="btn btn-primary"
              onClick={() => syncFromAPI(false)}
              disabled={syncing}
              style={{ justifyContent: 'center' }}
            >
              {syncing ? 'Synchronizuję...' : 'Pełny sync (wszystkie mecze)'}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => syncFromAPI(true)}
              disabled={syncing}
              style={{ justifyContent: 'center' }}
            >
              {syncing ? '...' : '⚡ Live sync (tylko trwające)'}
            </button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 10 }}>
            Pełny sync = 1 zapytanie API. Live sync = 1 zapytanie. Limit: 100/dzień na planie Free.
          </p>
        </div>

        {/* Gracze */}
        <div className="card">
          <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 15, marginBottom: 14 }}>👥 Gracze ({players.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {players.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: p.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0
                }}>
                  {p.name.slice(0, 2).toUpperCase()}
                </div>
                <span style={{ flex: 1 }}>{p.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{p.email}</span>
                <button
                  onClick={() => toggleAdmin(p.id, p.is_admin)}
                  style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 6,
                    background: p.is_admin ? 'var(--gold-dim)' : 'var(--bg3)',
                    color: p.is_admin ? 'var(--gold)' : 'var(--text3)',
                    border: 'none', cursor: 'pointer'
                  }}
                >
                  {p.is_admin ? 'Admin ✓' : 'Zrób adminem'}
                </button>
                <button
                  onClick={() => deletePlayer(p.id, p.name)}
                  style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 6,
                    background: 'var(--red-dim)', color: 'var(--red)',
                    border: 'none', cursor: 'pointer'
                  }}
                  title="Usuń gracza"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mecze — ręczne wyniki */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 15, marginBottom: 14 }}>
          ⚽ Mecze — ręczna korekta wyniku
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {matches.map(m => (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              fontSize: 13, flexWrap: 'wrap', padding: '6px 0',
              borderBottom: '1px solid var(--border)'
            }}>
              <span style={{ flex: 1, minWidth: 180 }}>
                {m.home_team} vs {m.away_team}
              </span>
              <span className={`badge ${m.status === 'finished' ? 'badge-gray' : m.status === 'live' ? 'badge-red' : 'badge-blue'}`}>
                {m.status}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  style={{ width: 40, textAlign: 'center', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6, padding: '4px', color: 'var(--text)', fontSize: 14 }}
                  defaultValue={m.home_score ?? ''}
                  onBlur={e => e.target.value !== '' && updateScore(m.id, 'home_score', e.target.value)}
                />
                <span style={{ color: 'var(--text3)' }}>:</span>
                <input
                  style={{ width: 40, textAlign: 'center', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6, padding: '4px', color: 'var(--text)', fontSize: 14 }}
                  defaultValue={m.away_score ?? ''}
                  onBlur={e => e.target.value !== '' && updateScore(m.id, 'away_score', e.target.value)}
                />
                <button
                  onClick={() => calcPoints(m.id)}
                  style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 6,
                    background: 'var(--green-dim)', color: 'var(--green)',
                    border: 'none', cursor: 'pointer'
                  }}
                >
                  Przelicz pkt
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Log */}
      <div className="card">
        <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 15, marginBottom: 14 }}>📋 Log synchronizacji</h3>
        {log.length === 0 ? (
          <p style={{ color: 'var(--text3)', fontSize: 13 }}>Brak wpisów</p>
        ) : (
          log.map(entry => (
            <div key={entry.id} style={{ fontSize: 12, color: 'var(--text2)', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text3)', marginRight: 10 }}>
                {new Date(entry.synced_at).toLocaleString('pl-PL')}
              </span>
              {entry.notes} · zaktualizowano {entry.matches_updated} meczów
            </div>
          ))
        )}
      </div>
    </div>
  )
}
