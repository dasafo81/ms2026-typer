import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { usePlayer } from '../hooks/usePlayer'
import { useEffect } from 'react'

export default function Layout() {
  const { player, loading, logout } = usePlayer()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !player) navigate('/login')
  }, [player, loading])

  if (loading) return null
  if (!player) return null

  const initials = player.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        background: '#0d0d0d',
        borderBottom: '2px solid #b8952a',
        position: 'sticky', top: 0, zIndex: 100
      }}>
        <div style={{
          maxWidth: 960, margin: '0 auto', padding: '0 16px',
          display: 'flex', alignItems: 'center', gap: 16, height: 64
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginRight: 12 }}>
            <img src="/logo.svg" alt="Karingtony 2026" style={{ height: 44, width: 'auto' }} />
          </div>

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
                  padding: '6px 14px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  color: isActive ? '#f5d87a' : '#9a8a6a',
                  background: isActive ? '#b8952a22' : 'transparent',
                  border: isActive ? '1px solid #b8952a44' : '1px solid transparent',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap'
                })}
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {player.is_admin && (
              <NavLink to="/admin" style={({ isActive }) => ({
                padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                color: isActive ? '#f5d87a' : '#b8952a',
                background: isActive ? '#b8952a22' : 'transparent',
              })}>
                ⚙️ Admin
              </NavLink>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%',
                background: player.avatar_color,
                border: '2px solid #b8952a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#fff'
              }}>{initials}</div>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#c9a84c' }}>{player.name}</span>
            </div>
            <button
              onClick={logout}
              style={{
                background: 'transparent', border: '1px solid #b8952a44',
                borderRadius: 6, padding: '5px 10px', fontSize: 12,
                color: '#9a8a6a', cursor: 'pointer'
              }}
            >
              Wyloguj
            </button>
          </div>
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: 960, margin: '0 auto', padding: '28px 16px', width: '100%' }}>
        <Outlet />
      </main>

      <footer style={{
        background: '#0d0d0d',
        borderTop: '1px solid #b8952a44',
        padding: '14px 16px',
        textAlign: 'center',
        fontSize: 12,
        color: '#5a4a2a',
        letterSpacing: 1,
        fontFamily: 'Georgia, serif'
      }}>
        KARINGTONY WORLD CUP LEAGUE · 2026
      </footer>
    </div>
  )
}
