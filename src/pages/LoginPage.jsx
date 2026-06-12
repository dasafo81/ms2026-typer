import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayer } from '../hooks/usePlayer'

export default function LoginPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = usePlayer()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return
    setLoading(true)
    setError('')
    try {
      await login(name, email)
      navigate('/')
    } catch (err) {
      if (err.message === 'PLAYER_NOT_FOUND') {
        setError('Nie znamy tego adresu email. Sprawdź czy nie ma literówki — lista uczestników jest zamknięta. Jeśli to Twój pierwszy raz, skontaktuj się z administratorem.')
      } else {
        setError('Błąd logowania. Spróbuj ponownie.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d0d0d',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <img src="/logo.svg" alt="Karingtony 2026" style={{ width: '100%', maxWidth: 380, height: 'auto' }} />
        </div>

        <div style={{
          background: '#fff',
          borderRadius: 12,
          border: '1px solid #e8e0d0',
          padding: 32,
          boxShadow: '0 4px 32px #b8952a20'
        }}>
          <div style={{
            textAlign: 'center',
            marginBottom: 24,
            paddingBottom: 20,
            borderBottom: '1px solid #e8e0d0'
          }}>
            <div style={{
              fontSize: 11, letterSpacing: 3, color: '#b8952a',
              fontFamily: 'Georgia, serif', textTransform: 'uppercase', marginBottom: 6
            }}>
              Dołącz do ligi
            </div>
            <div style={{ fontSize: 13, color: '#9a8a6a' }}>
              Wpisz swoje dane aby zacząć typować
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: '#9a8a6a', display: 'block', marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Imię / ksywka
              </label>
              <input
                className="input-field"
                type="text"
                placeholder="np. Damian"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={{ fontSize: 12, color: '#9a8a6a', display: 'block', marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Email
              </label>
              <input
                className="input-field"
                type="email"
                placeholder="twoj@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            {error && (
              <div style={{
                background: '#c0392b10', border: '1px solid #c0392b40',
                borderRadius: 8, padding: '10px 14px',
                fontSize: 13, color: '#c0392b', marginBottom: 16
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              style={{
                width: '100%', padding: '13px',
                background: '#b8952a', color: '#fff',
                border: 'none', borderRadius: 8,
                fontSize: 14, fontWeight: 700,
                letterSpacing: 1, cursor: 'pointer',
                fontFamily: 'Georgia, serif',
                textTransform: 'uppercase',
                transition: 'background 0.15s',
                opacity: loading ? 0.7 : 1
              }}
              disabled={loading}
            >
              {loading ? 'Łączę...' : 'Wchodzę w to'}
            </button>
          </form>

          <p style={{ fontSize: 11, color: '#b8a88a', marginTop: 14, textAlign: 'center' }}>
            Ten sam email = powrót do swojego konta
          </p>
        </div>

        <div style={{
          marginTop: 20,
          display: 'flex', justifyContent: 'center', gap: 32
        }}>
          {[
            { pts: '3', label: 'Dokładny wynik' },
            { pts: '1', label: 'Trafiony wynik' },
            { pts: '0', label: 'Pudło' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: 26, fontWeight: 800,
                color: s.pts === '3' ? '#f5d87a' : s.pts === '1' ? '#c9a84c' : '#5a4a2a',
                fontFamily: 'Georgia, serif'
              }}>{s.pts}</div>
              <div style={{ fontSize: 11, color: '#5a4a2a', letterSpacing: 0.5 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
