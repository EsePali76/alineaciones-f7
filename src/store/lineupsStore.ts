import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ConfirmedLineup } from '../domain/types'

interface LineupsState {
  lineups: ConfirmedLineup[]
  /** Guarda una alineación confirmada (ids de cada equipo). */
  addLineup: (teamA: string[], teamB: string[], fecha?: number) => void
  removeLineup: (id: string) => void
  /** Registra/edita el marcador de una alineación. */
  setResultado: (id: string, golesA: number, golesB: number) => void
  /** Borra el marcador de una alineación (queda sin jugar). */
  clearResultado: (id: string) => void
  clear: () => void
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `l_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export const useLineupsStore = create<LineupsState>()(
  persist(
    (set) => ({
      lineups: [],
      addLineup: (teamA, teamB, fecha = Date.now()) =>
        set((state) => ({
          lineups: [...state.lineups, { id: newId(), fecha, teamA, teamB }],
        })),
      removeLineup: (id) =>
        set((state) => ({ lineups: state.lineups.filter((l) => l.id !== id) })),
      setResultado: (id, golesA, golesB) =>
        set((state) => ({
          lineups: state.lineups.map((l) =>
            l.id === id ? { ...l, resultado: { golesA, golesB } } : l,
          ),
        })),
      clearResultado: (id) =>
        set((state) => ({
          lineups: state.lineups.map((l) =>
            l.id === id ? { ...l, resultado: undefined } : l,
          ),
        })),
      clear: () => set({ lineups: [] }),
    }),
    { name: 'alineaciones-f7-lineups' },
  ),
)
