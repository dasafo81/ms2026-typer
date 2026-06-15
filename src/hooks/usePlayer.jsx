import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const PlayerContext = createContext(null)
const DB_NAME = 'karingtony2026'
const DB_VERSION = 1
const STORE_NAME = 'session'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore(STORE_NAME, { keyPath: 'key' })
    }
    req.onsuccess = e => resolve(e.target.result)
    req.onerror = () => reject(req.error)
  })
}

async function dbGet(key) {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(key)
      req.onsuccess = () => resolve(req.result?.value ?? null)
      req.onerror = () => reject(req.error)
    })
  } catch { return null }
}

async function dbSet(key, value) {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put({ key, value })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {}
}

async function dbDelete(key) {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {}
}

export function PlayerProvider({ children }) {
  const [player, setPlayer] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      // Sprawdź IndexedDB
      const stored = await dbGet('player')
      if (stored) {
        setPlayer(stored)
        setLoading(false)
        return
      }
      // Migracja z cookie
      const cookieMatch = document.cookie.split(';').find(c => c.trim().startsWith('typer_player='))
      if (cookieMatch) {
        try {
          const p = JSON.parse(decodeURIComponent(cookieMatch.split('=').slice(1).join('=')))
          await dbSet('player', p)
          document.cookie = 'typer_player=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/'
          setPlayer(p)
          setLoading(false)
          return
        } catch {}
      }
      // Migracja z localStorage
      const ls = localStorage.getItem('typer_player')
      if (ls) {
        try {
          const p = JSON.parse(ls)
          await dbSet('player', p)
          localStorage.removeItem('typer_player')
          setPlayer(p)
          setLoading(false)
          return
        } catch {}
      }
      setLoading(false)
    }
    init()
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

    await dbSet('player', data)
    setPlayer(data)
    return data
  }

  async function logout() {
    await dbDelete('player')
    localStorage.removeItem('typer_player')
    document.cookie = 'typer_player=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/'
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
