import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { isKnockoutPhase, currentKnockoutStage, THEME } from '../lib/theme'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [knockout, setKnockout] = useState(false)
  const [currentStage, setCurrentStage] = useState(null)
  const [theme, setTheme] = useState(THEME.group)

  useEffect(() => {
    async function check() {
      const { data } = await supabase.from('matches').select('stage, status, kickoff_at')
      const ko = isKnockoutPhase(data || [])
      setKnockout(ko)
      setCurrentStage(currentKnockoutStage(data || []))
      setTheme(ko ? THEME.knockout : THEME.group)
    }
    check()
  }, [])

  return (
    <ThemeContext.Provider value={{ knockout, theme, currentStage }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
