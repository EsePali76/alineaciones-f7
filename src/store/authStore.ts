import { create } from 'zustand'
import { supabase } from '../lib/supabase'

interface AuthState {
  /** Hay sesión de admin activa (puede editar). */
  isAdmin: boolean
  email: string | null
  /** Sesión ya comprobada al arrancar. */
  ready: boolean
  init: () => void
  /** Inicia sesión; devuelve mensaje de error o null si OK. */
  login: (email: string, password: string) => Promise<string | null>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  isAdmin: false,
  email: null,
  ready: false,

  init: () => {
    supabase.auth.getSession().then(({ data }) => {
      set({
        isAdmin: !!data.session,
        email: data.session?.user.email ?? null,
        ready: true,
      })
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ isAdmin: !!session, email: session?.user.email ?? null })
    })
  },

  login: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error ? error.message : null
  },

  logout: async () => {
    await supabase.auth.signOut()
  },
}))
