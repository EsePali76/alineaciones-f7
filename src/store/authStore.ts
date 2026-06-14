import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { fetchProfile, type Profile } from '../lib/authApi'

interface AuthState {
  /** Sesión ya comprobada al arrancar. */
  ready: boolean
  /** Hay sesión iniciada (cualquier usuario). */
  isLoggedIn: boolean
  userId: string | null
  email: string | null
  /** Perfil cargado (rol, jugador vinculado, finalizado). null si anónimo o sin cargar. */
  profile: Profile | null

  /** Atajos derivados del perfil. */
  /** Tiene privilegios de admin (admin o superuser). Gating de funciones operativas. */
  isAdmin: boolean
  /** Admin REAL (rol 'admin'): único con acceso al menú Usuarios. */
  isFullAdmin: boolean
  /** Está vinculado a un jugador (puede actuar: votar, turnos…). */
  isLinked: boolean

  init: () => void
  refreshProfile: () => Promise<void>
  /** Registro; devuelve mensaje de error o null si OK. */
  register: (email: string, password: string, displayName: string) => Promise<string | null>
  /** Login; devuelve mensaje de error o null si OK. */
  login: (email: string, password: string) => Promise<string | null>
  logout: () => Promise<void>
}

function derive(profile: Profile | null) {
  return {
    profile,
    isAdmin: profile?.role === 'admin' || profile?.role === 'superuser',
    isFullAdmin: profile?.role === 'admin',
    isLinked: !!profile?.playerId,
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  ready: false,
  isLoggedIn: false,
  userId: null,
  email: null,
  profile: null,
  isAdmin: false,
  isFullAdmin: false,
  isLinked: false,

  init: () => {
    const apply = async (session: { user: { id: string; email?: string } } | null) => {
      if (!session) {
        set({ isLoggedIn: false, userId: null, email: null, ...derive(null), ready: true })
        return
      }
      set({ isLoggedIn: true, userId: session.user.id, email: session.user.email ?? null })
      try {
        const profile = await fetchProfile(session.user.id)
        set({ ...derive(profile), ready: true })
      } catch (e) {
        console.error('No se pudo cargar el perfil', e)
        set({ ...derive(null), ready: true })
      }
    }

    supabase.auth.getSession().then(({ data }) => apply(data.session))
    supabase.auth.onAuthStateChange((_event, session) => {
      apply(session)
    })
  },

  refreshProfile: async () => {
    const { userId } = get()
    if (!userId) return
    try {
      const profile = await fetchProfile(userId)
      set(derive(profile))
    } catch (e) {
      console.error(e)
    }
  },

  register: async (email, password, displayName) => {
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: displayName.trim() } },
    })
    if (error) return error.message
    // El trigger crea el profile; refrescamos por si la sesión ya está activa.
    await get().refreshProfile()
    return null
  },

  login: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    return error ? error.message : null
  },

  logout: async () => {
    await supabase.auth.signOut()
  },
}))
