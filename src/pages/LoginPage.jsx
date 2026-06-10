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
      setError('Błąd logowania. Spróbuj ponownie.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20,
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 36, margin: '0 auto 16px'
          }}>⚽</div>
          <h1 style={{ fontFamily: 'Space Grotesk', fontSize: 28, fontWeight: 700, marginBottom: 6 }}>
            Typer MŚ 2026
          </h1>
          <p style={{ color: 'var(--text2)', fontSize: 14 }}>
            Osiedlowa liga typowania wyników
          </p>
        </div>

        {/* Form */}
        <div className="card" style={{ padding: 28 }}>
          <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 600, marginBottom: 20 }}>
            Dołącz do zabawy
          </h2>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
                Twoje imię / ksywka
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

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
                Email (służy jako identyfikator)
              </label>
              <input
                className="input-field"
                type="email"
                placeholder="damian@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            {error && (
              <div style={{
                background: 'var(--red-dim)', border: '1px solid var(--red)',
                borderRadius: 8, padding: '10px 14px',
                fontSize: 13, color: 'var(--red)', marginBottom: 16
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: 12, fontSize: 15 }}
              disabled={loading}
            >
              {loading ? 'Łączę...' : 'Wchodzę w to →'}
            </button>
          </form>

          <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 16, textAlign: 'center' }}>
            Podaj ten sam email żeby wrócić do swojego konta
          </p>
        </div>

        {/* Rules */}
        <div style={{
          marginTop: 20, padding: '14px 18px',
          background: 'var(--bg2)', borderRadius: 10,
          border: '1px solid var(--border)'
        }}>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8, fontWeight: 600 }}>
            Zasady punktacji
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--green)', fontFamily: 'Space Grotesk' }}>3</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>dokładny wynik</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--gold)', fontFamily: 'Space Grotesk' }}>1</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>trafiony wynik (1X2)</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text3)', fontFamily: 'Space Grotesk' }}>0</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>pudło</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
