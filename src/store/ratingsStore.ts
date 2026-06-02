import { create } from 'zustand'
import type { PlayerRatings } from '../domain/types'
import * as api from '../lib/ratingsApi'
import { useAuthStore } from './authStore'
import { finalizeMyRatings } from '../lib/authApi'

interface RatingsState {
  /** Medias públicas por jugador (alimentan plantel + algoritmo). */
  averages: Map<string, api.RatingAverage>
  averagesLoaded: boolean
  /** Mis votos (borrador/definitivo) por jugador valorado. */
  mine: Map<string, PlayerRatings>
  mineLoaded: boolean

  loadAverages: () => Promise<void>
  loadMine: () => Promise<void>
  /** Guarda mi voto a un jugador y refresca medias. */
  saveMine: (rateePlayerId: string, values: PlayerRatings) => Promise<void>
  /** Finaliza (bloquea) mis valoraciones. */
  finalize: () => Promise<void>
}

export const useRatingsStore = create<RatingsState>((set, get) => ({
  averages: new Map(),
  averagesLoaded: false,
  mine: new Map(),
  mineLoaded: false,

  loadAverages: async () => {
    const averages = await api.fetchRatingAverages()
    set({ averages, averagesLoaded: true })
  },

  loadMine: async () => {
    const userId = useAuthStore.getState().userId
    if (!userId) {
      set({ mine: new Map(), mineLoaded: true })
      return
    }
    const mine = await api.fetchMyRatings(userId)
    set({ mine, mineLoaded: true })
  },

  saveMine: async (rateePlayerId, values) => {
    const userId = useAuthStore.getState().userId
    if (!userId) return
    await api.upsertMyRating(userId, rateePlayerId, values)
    const mine = new Map(get().mine)
    mine.set(rateePlayerId, values)
    set({ mine })
    // Refresca medias para reflejar el nuevo voto.
    await get().loadAverages()
  },

  finalize: async () => {
    await finalizeMyRatings()
    await useAuthStore.getState().refreshProfile()
  },
}))
