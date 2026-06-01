import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Player } from '../domain/types'

/** Datos editables de un jugador (todo menos id/createdAt, que gestiona el store). */
export type PlayerInput = Omit<Player, 'id' | 'createdAt'>

interface PlayersState {
  players: Player[]
  addPlayer: (input: PlayerInput) => void
  updatePlayer: (id: string, input: PlayerInput) => void
  removePlayer: (id: string) => void
  /** Reemplaza todo el plantel (para import de JSON). */
  replaceAll: (players: Player[]) => void
}

function newId(): string {
  // crypto.randomUUID está disponible en navegadores modernos; fallback por si acaso.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export const usePlayersStore = create<PlayersState>()(
  persist(
    (set) => ({
      players: [],
      addPlayer: (input) =>
        set((state) => ({
          players: [...state.players, { ...input, id: newId(), createdAt: Date.now() }],
        })),
      updatePlayer: (id, input) =>
        set((state) => ({
          players: state.players.map((p) => (p.id === id ? { ...p, ...input } : p)),
        })),
      removePlayer: (id) =>
        set((state) => ({ players: state.players.filter((p) => p.id !== id) })),
      replaceAll: (players) => set({ players }),
    }),
    {
      name: 'alineaciones-f7-players',
      // v2: escala 1-5 → 0-10 (×2) y rename de valoración `calidad` → `tecnica`.
      version: 2,
      migrate: (persisted, version) => {
        const state = persisted as { players?: unknown[] } | undefined
        if (!state || version >= 2) return state as PlayersState

        const x2 = (v: unknown): number | undefined =>
          typeof v === 'number' ? Math.min(10, Math.max(0, Math.round(v * 2))) : undefined

        state.players = (state.players ?? []).map((raw) => {
          const p = raw as { ratings?: Record<string, unknown>; tocado?: boolean }
          const r = p.ratings ?? {}
          return {
            ...p,
            tocado: p.tocado ?? false,
            ratings: {
              // calidad antigua → tecnica; si ya hubiera tecnica, se respeta.
              tecnica: x2(r.tecnica ?? r.calidad),
              disparo: x2(r.disparo),
              presion: x2(r.presion),
              velocidad: x2(r.velocidad),
              fisico: x2(r.fisico),
              forma: x2(r.forma),
              animo: x2(r.animo),
            },
          }
        })
        return state as PlayersState
      },
    },
  ),
)
