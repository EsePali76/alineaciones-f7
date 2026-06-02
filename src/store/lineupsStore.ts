import { create } from 'zustand'
import type { ConfirmedLineup, MatchResult } from '../domain/types'
import * as api from '../lib/dataApi'

/** Metadatos opcionales de una alineación (quién la hizo + cómo dibujarla). */
export interface LineupMeta {
  madeBy?: string
  formacionA?: string
  formacionB?: string
  placementA?: string[] | null
  placementB?: string[] | null
}

interface LineupsState {
  lineups: ConfirmedLineup[]
  loaded: boolean
  load: () => Promise<void>
  /** Guarda una alineación confirmada (ids de cada equipo + metadatos). Devuelve su id. */
  addLineup: (teamA: string[], teamB: string[], meta?: LineupMeta, fecha?: number) => Promise<string>
  /** Actualiza equipos y metadatos de una alineación ya confirmada (re-confirmar editando). */
  updateLineupTeams: (
    id: string,
    teamA: string[],
    teamB: string[],
    meta?: LineupMeta,
  ) => Promise<void>
  removeLineup: (id: string) => Promise<void>
  /** Registra/edita el resultado completo de una alineación (marcador + goles + asistencias). */
  setResultado: (id: string, resultado: MatchResult) => Promise<void>
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

  addLineup: async (teamA, teamB, meta = {}, fecha = Date.now()) => {
    const lineup: ConfirmedLineup = {
      id: newId(),
      fecha,
      teamA,
      teamB,
      madeBy: meta.madeBy,
      formacionA: meta.formacionA,
      formacionB: meta.formacionB,
      placementA: meta.placementA ?? undefined,
      placementB: meta.placementB ?? undefined,
    }
    const prev = get().lineups
    set({ lineups: [...prev, lineup] })
    try {
      await api.upsertLineup(lineup)
    } catch (e) {
      set({ lineups: prev })
      avisoError(e)
    }
    return lineup.id
  },

  updateLineupTeams: (id, teamA, teamB, meta = {}) =>
    actualizar(get, set, id, (l) => ({
      ...l,
      teamA,
      teamB,
      formacionA: meta.formacionA ?? l.formacionA,
      formacionB: meta.formacionB ?? l.formacionB,
      placementA: meta.placementA ?? undefined,
      placementB: meta.placementB ?? undefined,
    })),

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

  setResultado: (id, resultado) =>
    actualizar(get, set, id, (l) => ({ ...l, resultado })),

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
