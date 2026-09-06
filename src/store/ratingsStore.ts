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
  /** Cuántos lleva valorados cada jugador, de cuántos le tocan (recuento público). */
  progress: Map<string, api.RatingProgress>

  loadAverages: () => Promise<void>
  loadProgress: () => Promise<void>
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
  progress: new Map(),

  loadAverages: async () => {
    const averages = await api.fetchRatingAverages()
    set({ averages, averagesLoaded: true })
  },

  loadProgress: async () => {
    set({ progress: await api.fetchRatingProgress() })
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
    // Refresca medias y progreso para reflejar el nuevo voto (el progreso decide
    // quién entra en la cola de alineadores cuando el filtro está activo).
    await Promise.all([get().loadAverages(), get().loadProgress()])
  },

  finalize: async () => {
    await finalizeMyRatings()
    await useAuthStore.getState().refreshProfile()
  },
}))
