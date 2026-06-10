import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const PlayerContext = createContext(null)

const COOKIE_NAME = 'typer_player'
const COOKIE_DAYS = 90

function setCookie(value) {
  const expires = new Date()
  expires.setDate(expires.getDate() + COOKIE_DAYS)
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(value))};expires=${expires.toUTCString()};path=/;SameSite=Lax`
}

function getCookie() {
  const match = document.cookie.split(';').find(c => c.trim().startsWith(COOKIE_NAME + '='))
  if (!match) return null
  try {
    return JSON.parse(decodeURIComponent(match.split('=').slice(1).join('=')))
  } catch { return null }
}

function deleteCookie() {
  document.cookie = `${COOKIE_NAME}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/`
}

export function PlayerProvider({ children }) {
  const [player, setPlayer] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Sprawdź cookie najpierw, potem localStorage (migracja starych sesji)
    const fromCookie = getCookie()
    const fromStorage = localStorage.getItem('typer_player')

    if (fromCookie) {
      setPlayer(fromCookie)
    } else if (fromStorage) {
      try {
        const p = JSON.parse(fromStorage)
        setPlayer(p)
        setCookie(p) // migruj do cookie
        localStorage.removeItem('typer_player')
      } catch {}
    }
    setLoading(false)
  }, [])

  async function login(name, email) {
    let { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .single()

    if (error && error.code === 'PGRST116') {
      const colors = ['#e53935','#8e24aa','#1e88e5','#00897b','#f4511e','#6d4c41','#546e7a']
      const color = colors[Math.floor(Math.random() * colors.length)]
      const { data: newPlayer, error: insertError } = await supabase
        .from('players')
        .insert({ name: name.trim(), email: email.toLowerCase().trim(), avatar_color: color })
        .select()
        .single()
      if (insertError) throw insertError
      data = newPlayer
    } else if (error) {
      throw error
    }

    setCookie(data)
    localStorage.removeItem('typer_player')
    setPlayer(data)
    return data
  }

  function logout() {
    deleteCookie()
    localStorage.removeItem('typer_player')
    setPlayer(null)
  }

  return (
    <PlayerContext.Provider value={{ player, loading, login, logout }}>
      {children}
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  return useContext(PlayerContext)
}
