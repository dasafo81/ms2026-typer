import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { isKnockoutPhase, THEME } from '../lib/theme'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [knockout, setKnockout] = useState(false)
  const [theme, setTheme] = useState(THEME.group)

  useEffect(() => {
    async function check() {
      const { data } = await supabase.from('matches').select('stage, status, kickoff_at')
      const ko = isKnockoutPhase(data || [])
      setKnockout(ko)
      setTheme(ko ? THEME.knockout : THEME.group)
    }
    check()
  }, [])

  return (
    <ThemeContext.Provider value={{ knockout, theme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
