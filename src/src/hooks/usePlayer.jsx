import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const PlayerContext = createContext(null)

export function PlayerProvider({ children }) {
  const [player, setPlayer] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('typer_player')
    if (stored) {
      try { setPlayer(JSON.parse(stored)) } catch {}
    }
    setLoading(false)
  }, [])

  async function login(name, email) {
    // Sprawdź czy gracz istnieje
    let { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .single()

    if (error && error.code === 'PGRST116') {
      // Nowy gracz — zarejestruj
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

    localStorage.setItem('typer_player', JSON.stringify(data))
    setPlayer(data)
    return data
  }

  function logout() {
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
