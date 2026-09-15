import { create } from 'zustand'
import * as api from '../lib/rotationApi'
import {
  advanceAfterConfirm,
  advancePass,
  esElegibleRotacion,
  seed,
  type RotationData,
} from '../domain/rotation'
import { usePlayersStore } from './playersStore'
import { useConvocatoriaStore } from './convocatoriaStore'
import { DIA_PARTIDO_DEFECTO, fechaEfectiva } from '../domain/matchday'

/** Ids de jugadores elegibles para la rotación, en orden estable (por antigüedad). */
function eligibleOrdered(): string[] {
  return usePlayersStore
    .getState()
    .players.filter(esElegibleRotacion)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((p) => p.id)
}

/** Mezcla aleatoria (Fisher-Yates) de los ids elegibles. */
function eligibleShuffled(): string[] {
  const ids = eligibleOrdered()
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
  }
  return ids
}

interface RotationState {
  data: RotationData
  /**
   * Ventana global de re-evaluación abierta (intención del admin). OJO: para saber
   * si el plazo está REALMENTE vigente hay que cruzarlo con `ratingsDeadline` —
   * usa el hook `useRatingsWindow`, no este flag a pelo.
   */
  ratingsOpen: boolean
  /** Fecha límite del plazo ('YYYY-MM-DD'); null = sin fecha de fin. */
  ratingsDeadline: string | null
  /**
   * Filtro activo: solo entra en la cola de alineadores quien ha valorado a todos.
   * Ver `filtrarPorValoraciones` (dominio) y `useTurno` (donde se aplica).
   */
  requireRatings: boolean
  /** Override de fecha del próximo partido ('YYYY-MM-DD'); null = automática. */
  matchDate: string | null
  /**
   * Día fijo de partido (0 domingo … 6 sábado). Lo cambian admin y superuser desde
   * el banner. `matchDate` (override de un partido suelto) manda sobre él.
   */
  matchWeekday: number
  loaded: boolean
  load: () => Promise<void>
  /** "Esta semana no hay partido": empuja la fecha una semana (admin). NO toca la cola. */
  posponerJornada: (nuevaFecha: string) => Promise<void>
  /** Fija una fecha arbitraria para el próximo partido, o null para volver al automático (admin). */
  fijarFecha: (fechaISO: string | null) => Promise<void>
  /** Cambia el día fijo de partido (admin/superuser). NO toca la cola de turnos. */
  fijarDiaSemana: (dow: number) => Promise<void>
  /** Pasa turno (lo llama el del turno) o avanza (admin). Conserva el sitio del que pasa. */
  pasarTurno: () => Promise<void>
  /** Siembra/reinicia la cola con los elegibles actuales (admin). */
  reiniciar: () => Promise<void>
  /** Tras confirmar una alineación: el autor va al final y empieza ciclo nuevo. */
  alConfirmar: (doerId: string) => Promise<void>
  /** Abre/cierra el plazo de re-evaluación de valoraciones (admin). */
  setRatingsOpen: (open: boolean) => Promise<void>
  /** Fija/quita la fecha límite del plazo (admin). */
  setRatingsDeadline: (fechaISO: string | null) => Promise<void>
  /** Activa/desactiva el filtro de valoraciones sobre la cola (admin). */
  setRequireRatings: (on: boolean) => Promise<void>
}

/**
 * Arrastra los apuntes de la convocatoria a la nueva fecha cuando la jornada se
 * mueve (cambio de día fijo o de fecha suelta), para que no se "pierdan". No es
 * crítico si falla: el admin puede reintentar volviendo a tocar la fecha.
 */
async function migrarConvocados(antes: string, despues: string) {
  if (antes === despues) return
  try {
    await useConvocatoriaStore.getState().migrar(antes, despues)
  } catch {
    /* se puede reintentar cambiando la fecha de nuevo */
  }
}

async function persist(set: (p: Partial<RotationState>) => void, data: RotationData) {
  set({ data })
  await api.saveRotation(data)
}

export const useRotationStore = create<RotationState>((set, get) => ({
  data: { currentPlayerId: null, orderIds: [], skippedIds: [] },
  ratingsOpen: false,
  ratingsDeadline: null,
  requireRatings: false,
  matchDate: null,
  matchWeekday: DIA_PARTIDO_DEFECTO,
  loaded: false,

  load: async () => {
    const { rotation, ratingsOpen, ratingsDeadline, requireRatings, matchDate, matchWeekday } =
      await api.fetchRotation()
    set({
      data: rotation,
      ratingsOpen,
      ratingsDeadline,
      requireRatings,
      matchDate,
      matchWeekday,
      loaded: true,
    })
  },

  posponerJornada: async (nuevaFecha) => {
    await get().fijarFecha(nuevaFecha)
  },

  fijarFecha: async (fechaISO) => {
    const prev = get().matchDate
    const dow = get().matchWeekday
    const antes = fechaEfectiva(prev, dow)
    const despues = fechaEfectiva(fechaISO, dow)
    set({ matchDate: fechaISO })
    try {
      await api.saveMatchDate(fechaISO)
    } catch (e) {
      set({ matchDate: prev })
      throw e
    }
    await migrarConvocados(antes, despues)
  },

  fijarDiaSemana: async (dow) => {
    const prev = get().matchWeekday
    if (dow === prev) return
    const override = get().matchDate
    const antes = fechaEfectiva(override, prev)
    set({ matchWeekday: dow })
    try {
      await api.setMatchWeekday(dow)
    } catch (e) {
      set({ matchWeekday: prev })
      throw e
    }
    // Cambiar el día fijo tira el override de fecha suelta que hubiera pendiente:
    // si no, un "este partido lo movemos al día X" de la semana pasada seguiría
    // ganando y el cambio de día parecería no haber hecho nada.
    if (override) {
      set({ matchDate: null })
      try {
        await api.saveMatchDate(null)
      } catch {
        set({ matchDate: override })
      }
    }
    await migrarConvocados(antes, fechaEfectiva(get().matchDate, dow))
  },

  pasarTurno: async () => {
    const next = advancePass(get().data, eligibleOrdered())
    await persist(set, next)
  },

  reiniciar: async () => {
    // Orden ALEATORIO de los elegibles (no por antigüedad).
    const next = seed(eligibleShuffled())
    await persist(set, next)
  },

  alConfirmar: async (doerId) => {
    const next = advanceAfterConfirm(get().data, doerId, eligibleOrdered())
    await persist(set, next)
  },

  setRatingsOpen: async (open) => {
    set({ ratingsOpen: open })
    try {
      await api.setRatingsOpen(open)
    } catch (e) {
      // Revierte el optimista si la RPC falla.
      set({ ratingsOpen: !open })
      throw e
    }
  },

  setRatingsDeadline: async (fechaISO) => {
    const prev = get().ratingsDeadline
    set({ ratingsDeadline: fechaISO })
    try {
      await api.setRatingsDeadline(fechaISO)
    } catch (e) {
      set({ ratingsDeadline: prev })
      throw e
    }
  },

  setRequireRatings: async (on) => {
    set({ requireRatings: on })
    try {
      await api.setRequireRatings(on)
    } catch (e) {
      set({ requireRatings: !on })
      throw e
    }
  },
}))
