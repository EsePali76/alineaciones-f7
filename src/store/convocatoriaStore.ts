import { create } from 'zustand'
import * as api from '../lib/convocatoriaApi'
import type { SignupRow, SignupStatus } from '../lib/convocatoriaApi'

/**
 * Estado COMPARTIDO de la convocatoria (quién se ha apuntado). Vive en Supabase
 * (tabla `signups`); aquí solo se cachea. Cada usuario gestiona su propio apunte;
 * la lista la consume el del turno/admin en la pestaña Equipos.
 */
interface ConvocatoriaState {
  signups: SignupRow[]
  loaded: boolean
  load: () => Promise<void>
  /** Apuntarse / cambiar de estado en la jornada dada. */
  apuntarse: (playerId: string, status: SignupStatus, matchDate: string) => Promise<void>
  /** Borrarse de la convocatoria. */
  borrarse: (playerId: string) => Promise<void>
}

export const useConvocatoriaStore = create<ConvocatoriaState>((set, get) => ({
  signups: [],
  loaded: false,

  load: async () => {
    const signups = await api.fetchSignups()
    set({ signups, loaded: true })
  },

  apuntarse: async (playerId, status, matchDate) => {
    await api.setSignup(playerId, status, matchDate)
    // Releemos para tener el created_at definitivo (orden de llegada correcto).
    set({ signups: await api.fetchSignups() })
  },

  borrarse: async (playerId) => {
    const prev = get().signups
    set({ signups: prev.filter((s) => s.player_id !== playerId) })
    try {
      await api.deleteSignup(playerId)
    } catch (e) {
      set({ signups: prev })
      throw e
    }
  },
}))
