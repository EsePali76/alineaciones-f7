import { create } from 'zustand'
import type { Player } from '../domain/types'
import * as api from '../lib/dataApi'

/** Datos editables de un jugador (todo menos id/createdAt, que gestiona el store). */
export type PlayerInput = Omit<Player, 'id' | 'createdAt'>

interface PlayersState {
  players: Player[]
  loaded: boolean
  load: () => Promise<void>
  /** Da de alta un jugador. Devuelve su id (o null si falló el guardado en la nube). */
  addPlayer: (input: PlayerInput) => Promise<string | null>
  updatePlayer: (id: string, input: PlayerInput) => Promise<void>
  removePlayer: (id: string) => Promise<void>
  /** Reemplaza/sube todo el plantel (import o migración). */
  replaceAll: (players: Player[]) => Promise<void>
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function avisoError(e: unknown) {
  console.error(e)
  alert('No se pudo guardar en la nube. ¿Has entrado como admin? Se han recargado los datos.')
}

export const usePlayersStore = create<PlayersState>((set, get) => ({
  players: [],
  loaded: false,

  load: async () => {
    const players = await api.fetchPlayers()
    set({ players, loaded: true })
  },

  addPlayer: async (input) => {
    const player: Player = { ...input, id: newId(), createdAt: Date.now() }
    const prev = get().players
    set({ players: [...prev, player] }) // optimista
    try {
      await api.upsertPlayer(player)
      return player.id
    } catch (e) {
      set({ players: prev })
      avisoError(e)
      return null
    }
  },

  updatePlayer: async (id, input) => {
    const prev = get().players
    const updated = prev.map((p) => (p.id === id ? { ...p, ...input } : p))
    const player = updated.find((p) => p.id === id)
    set({ players: updated })
    try {
      if (player) await api.updatePlayer(player)
    } catch (e) {
      set({ players: prev })
      avisoError(e)
      throw e // que el llamante sepa que falló (p.ej. para no mostrar "guardado")
    }
  },

  removePlayer: async (id) => {
    const prev = get().players
    set({ players: prev.filter((p) => p.id !== id) })
    try {
      await api.deletePlayer(id)
    } catch (e) {
      set({ players: prev })
      avisoError(e)
    }
  },

  replaceAll: async (players) => {
    const prev = get().players
    set({ players })
    try {
      await api.upsertPlayers(players)
    } catch (e) {
      set({ players: prev })
      avisoError(e)
    }
  },
}))
