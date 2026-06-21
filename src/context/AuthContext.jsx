import { useEffect, useMemo, useState } from 'react'
import { hasSupabaseConfig, supabase } from '../lib/supabase'
import { AuthContext } from './auth'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadSession() {
      if (!hasSupabaseConfig || !supabase) {
        setLoading(false)
        return
      }

      const { data } = await supabase.auth.getSession()
      if (active) {
        setSession(data.session)
        setLoading(false)
      }
    }

    loadSession()

    if (!supabase) return () => undefined

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(
    () => ({
      hasSupabaseConfig,
      loading,
      session,
      supabase,
      user: session?.user ?? null,
    }),
    [loading, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
