import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const PlayerContext = createContext(null)
const KEY = 'karingtony_player_v2'

export function PlayerProvider({ children }) {
  const [player, setPlayer] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY)
      if (stored) setPlayer(JSON.parse(stored))
    } catch {}
    setLoading(false)
  }, [])

  async function login(name, email) {
    let { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .single()

    if (error && error.code === 'PGRST116') {
      throw new Error('PLAYER_NOT_FOUND')
    } else if (error) {
      throw error
    }

    localStorage.setItem(KEY, JSON.stringify(data))
    setPlayer(data)
    return data
  }

  function logout() {
    localStorage.removeItem(KEY)
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
