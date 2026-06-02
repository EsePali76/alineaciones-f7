import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TeamBalance } from '../domain/balancer'

/**
 * Estado de la sesión de generación de equipos. Vive en un store persistente para
 * que NO se pierda al cambiar de pestaña ni al recargar: la alineación generada se
 * mantiene hasta que se genera otra nueva.
 */
interface GeneratorState {
  /** Ids de los jugadores convocados. */
  convocados: string[]
  jugadoresPorEquipo: 6 | 7 | 8
  /** Formación de cada equipo para dibujar el campo (p.ej. "1-3-2-1"). */
  formacionNombreA: string
  formacionNombreB: string
  /**
   * Colocación manual de cada equipo (ids en orden de puesto), si el usuario ha
   * intercambiado fichas arrastrando. null = usar la colocación automática.
   */
  placementA: string[] | null
  placementB: string[] | null
  /** Última alineación generada (null si aún no se ha generado). */
  balance: TeamBalance | null
  /** Si la alineación actual ya se confirmó en el historial. */
  confirmada: boolean
  /** Id de la alineación confirmada (para re-confirmar editando la misma, no crear otra). */
  confirmedLineupId: string | null
  setConvocados: (ids: string[]) => void
  setJugadoresPorEquipo: (n: 6 | 7 | 8) => void
  setFormacionNombreA: (nombre: string) => void
  setFormacionNombreB: (nombre: string) => void
  setPlacementA: (ids: string[] | null) => void
  setPlacementB: (ids: string[] | null) => void
  setBalance: (b: TeamBalance | null) => void
  setConfirmada: (v: boolean) => void
  setConfirmedLineupId: (id: string | null) => void
}

export const useGeneratorStore = create<GeneratorState>()(
  persist(
    (set) => ({
      convocados: [],
      jugadoresPorEquipo: 7,
      formacionNombreA: '1-3-2-1',
      formacionNombreB: '1-3-2-1',
      placementA: null,
      placementB: null,
      balance: null,
      confirmada: false,
      confirmedLineupId: null,
      setConvocados: (ids) => set({ convocados: ids }),
      setJugadoresPorEquipo: (n) => set({ jugadoresPorEquipo: n }),
      setFormacionNombreA: (nombre) => set({ formacionNombreA: nombre }),
      setFormacionNombreB: (nombre) => set({ formacionNombreB: nombre }),
      setPlacementA: (ids) => set({ placementA: ids }),
      setPlacementB: (ids) => set({ placementB: ids }),
      setBalance: (b) => set({ balance: b }),
      setConfirmada: (v) => set({ confirmada: v }),
      setConfirmedLineupId: (id) => set({ confirmedLineupId: id }),
    }),
    { name: 'alineaciones-f7-generator' },
  ),
)
