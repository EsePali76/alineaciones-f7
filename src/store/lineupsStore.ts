import { create } from 'zustand'
import type { ConfirmedLineup } from '../domain/types'
import * as api from '../lib/dataApi'

interface LineupsState {
  lineups: ConfirmedLineup[]
  loaded: boolean
  load: () => Promise<void>
  /** Guarda una alineación confirmada (ids de cada equipo). */
  addLineup: (teamA: string[], teamB: string[], fecha?: number) => Promise<void>
  removeLineup: (id: string) => Promise<void>
  /** Registra/edita el marcador de una alineación. */
  setResultado: (id: string, golesA: number, golesB: number) => Promise<void>
  /** Borra el marcador de una alineación (queda sin jugar). */
  clearResultado: (id: string) => Promise<void>
  /** Sube en bloque (import/migración). */
  replaceAll: (lineups: ConfirmedLineup[]) => Promise<void>
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `l_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function avisoError(e: unknown) {
  console.error(e)
  alert('No se pudo guardar en la nube. ¿Has entrado como admin? Se han recargado los datos.')
}

/** Aplica una actualización al lineup `id` y lo sincroniza con Supabase (con reversión). */
async function actualizar(
  get: () => LineupsState,
  set: (partial: Partial<LineupsState>) => void,
  id: string,
  cambio: (l: ConfirmedLineup) => ConfirmedLineup,
) {
  const prev = get().lineups
  const actualizado = prev.map((l) => (l.id === id ? cambio(l) : l))
  const lineup = actualizado.find((l) => l.id === id)
  set({ lineups: actualizado })
  try {
    if (lineup) await api.upsertLineup(lineup)
  } catch (e) {
    set({ lineups: prev })
    avisoError(e)
  }
}

export const useLineupsStore = create<LineupsState>((set, get) => ({
  lineups: [],
  loaded: false,

  load: async () => {
    const lineups = await api.fetchLineups()
    set({ lineups, loaded: true })
  },

  addLineup: async (teamA, teamB, fecha = Date.now()) => {
    const lineup: ConfirmedLineup = { id: newId(), fecha, teamA, teamB }
    const prev = get().lineups
    set({ lineups: [...prev, lineup] })
    try {
      await api.upsertLineup(lineup)
    } catch (e) {
      set({ lineups: prev })
      avisoError(e)
    }
  },

  removeLineup: async (id) => {
    const prev = get().lineups
    set({ lineups: prev.filter((l) => l.id !== id) })
    try {
      await api.deleteLineup(id)
    } catch (e) {
      set({ lineups: prev })
      avisoError(e)
    }
  },

  setResultado: (id, golesA, golesB) =>
    actualizar(get, set, id, (l) => ({ ...l, resultado: { golesA, golesB } })),

  clearResultado: (id) => actualizar(get, set, id, (l) => ({ ...l, resultado: undefined })),

  replaceAll: async (lineups) => {
    const prev = get().lineups
    set({ lineups })
    try {
      await api.upsertLineups(lineups)
    } catch (e) {
      set({ lineups: prev })
      avisoError(e)
    }
  },
}))
