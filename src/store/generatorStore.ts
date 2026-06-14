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
  /**
   * Jornada ('YYYY-MM-DD') a la que pertenece la convocatoria sembrada actual. Al
   * cambiar de jornada se parte de cero (nueva semana). null = aún sin sembrar.
   */
  convocatoriaDate: string | null
  /**
   * Últimos ids de titulares ('Me apunto') con los que se sincronizaron los
   * convocados. Permite hacer diffs incrementales: añadir a los nuevos apuntados y
   * quitar a los que se desapuntan, SIN pisar los ajustes manuales del del turno.
   */
  lastSyncedSignupIds: string[]
  /**
   * Siembra los convocados con los titulares apuntados (en vivo, según la gente se
   * apunta). Diff incremental contra `lastSyncedSignupIds`: añade nuevos, quita a
   * los que se borran; conserva los añadidos a mano. Resetea al cambiar de jornada.
   */
  syncConvocatoria: (titularIds: string[], fecha: string) => void
  setConvocados: (ids: string[]) => void
  setJugadoresPorEquipo: (n: 6 | 7 | 8) => void
  setFormacionNombreA: (nombre: string) => void
  setFormacionNombreB: (nombre: string) => void
  setPlacementA: (ids: string[] | null) => void
  setPlacementB: (ids: string[] | null) => void
  setBalance: (b: TeamBalance | null) => void
  setConfirmada: (v: boolean) => void
  setConfirmedLineupId: (id: string | null) => void
  /**
   * Vuelve la sesión a cero (formato, formaciones, convocados, colocación y la
   * alineación generada). Se usa al cerrar un partido: una vez registrado su
   * resultado, la convocatoria anterior ya no debe arrastrarse a la siguiente.
   */
  reset: () => void
}

/** Valores de partida (también los usa `reset`). */
const INICIAL = {
  convocados: [] as string[],
  jugadoresPorEquipo: 7 as 6 | 7 | 8,
  formacionNombreA: '1-3-2-1',
  formacionNombreB: '1-3-2-1',
  placementA: null as string[] | null,
  placementB: null as string[] | null,
  balance: null as TeamBalance | null,
  confirmada: false,
  confirmedLineupId: null as string | null,
  convocatoriaDate: null as string | null,
  lastSyncedSignupIds: [] as string[],
}

export const useGeneratorStore = create<GeneratorState>()(
  persist(
    (set) => ({
      ...INICIAL,
      syncConvocatoria: (titularIds, fecha) =>
        set((state) => {
          // Nueva jornada → parte de cero (la convocatoria anterior no se arrastra).
          const nuevaJornada = state.convocatoriaDate !== fecha
          const baseConvocados = nuevaJornada ? [] : state.convocados
          const prevSync = new Set(nuevaJornada ? [] : state.lastSyncedSignupIds)
          const curSync = new Set(titularIds)

          const convocados = [...baseConvocados]
          // Añade a los nuevos apuntados (no estaban antes ni ya en la lista).
          for (const id of titularIds) {
            if (!prevSync.has(id) && !convocados.includes(id)) convocados.push(id)
          }
          // Quita a los que se han desapuntado (estaban sincronizados y ya no apuntados).
          // Los añadidos a mano (no son titulares ni lo fueron) se conservan.
          const limpio = convocados.filter((id) => !(prevSync.has(id) && !curSync.has(id)))

          return { convocados: limpio, lastSyncedSignupIds: titularIds, convocatoriaDate: fecha }
        }),
      setConvocados: (ids) => set({ convocados: ids }),
      setJugadoresPorEquipo: (n) => set({ jugadoresPorEquipo: n }),
      setFormacionNombreA: (nombre) => set({ formacionNombreA: nombre }),
      setFormacionNombreB: (nombre) => set({ formacionNombreB: nombre }),
      setPlacementA: (ids) => set({ placementA: ids }),
      setPlacementB: (ids) => set({ placementB: ids }),
      setBalance: (b) => set({ balance: b }),
      setConfirmada: (v) => set({ confirmada: v }),
      setConfirmedLineupId: (id) => set({ confirmedLineupId: id }),
      reset: () => set({ ...INICIAL }),
    }),
    { name: 'alineaciones-f7-generator' },
  ),
)
