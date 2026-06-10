import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { usePlayer } from '../hooks/usePlayer'
import { useEffect } from 'react'

export default function Layout() {
  const { player, logout } = usePlayer()
  const navigate = useNavigate()

  useEffect(() => {
    if (!player) navigate('/login')
  }, [player])

  if (!player) return null

  const initials = player.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        background: 'var(--bg2)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0, zIndex: 100
      }}>
        <div style={{
          maxWidth: 960, margin: '0 auto', padding: '0 16px',
          display: 'flex', alignItems: 'center', gap: 16, height: 60
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 8 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, var(--green) 0%, #00695c 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18
            }}>⚽</div>
            <div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>Typer</div>
              <div style={{ fontSize: 10, color: 'var(--text2)', letterSpacing: 1 }}>MŚ 2026</div>
            </div>
          </div>

          {/* Nav */}
          <nav style={{ display: 'flex', gap: 4, flex: 1 }}>
            {[
              { to: '/', label: '🏆 Ranking' },
              { to: '/mecze', label: '📅 Mecze' },
              { to: '/moje-typy', label: '✏️ Moje typy' },
            ].map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                style={({ isActive }) => ({
                  padding: '6px 12px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  color: isActive ? 'var(--green)' : 'var(--text2)',
                  background: isActive ? 'var(--green-dim)' : 'transparent',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap'
                })}
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {/* User */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {player.is_admin && (
              <NavLink to="/admin" style={({ isActive }) => ({
                padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                color: isActive ? 'var(--gold)' : 'var(--text3)',
                background: isActive ? 'var(--gold-dim)' : 'transparent',
              })}>
                ⚙️ Admin
              </NavLink>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: player.avatar_color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#fff'
              }}>{initials}</div>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)' }}
                className="hide-mobile">{player.name}</span>
            </div>
            <button
              onClick={logout}
              style={{
                background: 'transparent', border: '1px solid var(--border2)',
                borderRadius: 6, padding: '5px 10px', fontSize: 12,
                color: 'var(--text2)', cursor: 'pointer'
              }}
            >
              Wyloguj
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main style={{ flex: 1, maxWidth: 960, margin: '0 auto', padding: '24px 16px', width: '100%' }}>
        <Outlet />
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border)',
        padding: '12px 16px',
        textAlign: 'center',
        fontSize: 12,
        color: 'var(--text3)'
      }}>
        Typer MŚ 2026 · Osiedlowa Liga · {new Date().getFullYear()}
      </footer>
    </div>
  )
}
