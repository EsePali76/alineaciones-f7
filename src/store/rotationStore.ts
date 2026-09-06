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
import { fechaEfectiva } from '../domain/matchday'

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
  loaded: boolean
  load: () => Promise<void>
  /** "Este lunes no hay partido": empuja la fecha al siguiente lunes (admin). NO toca la cola. */
  posponerJornada: (nuevaFecha: string) => Promise<void>
  /** Fija una fecha arbitraria para el próximo partido, o null para volver al automático (admin). */
  fijarFecha: (fechaISO: string | null) => Promise<void>
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
  loaded: false,

  load: async () => {
    const { rotation, ratingsOpen, ratingsDeadline, requireRatings, matchDate } =
      await api.fetchRotation()
    set({ data: rotation, ratingsOpen, ratingsDeadline, requireRatings, matchDate, loaded: true })
  },

  posponerJornada: async (nuevaFecha) => {
    await get().fijarFecha(nuevaFecha)
  },

  fijarFecha: async (fechaISO) => {
    const prev = get().matchDate
    const antes = fechaEfectiva(prev)
    const despues = fechaEfectiva(fechaISO)
    set({ matchDate: fechaISO })
    try {
      await api.saveMatchDate(fechaISO)
    } catch (e) {
      set({ matchDate: prev })
      throw e
    }
    // Reprogramación: arrastra los convocados de la jornada anterior a la nueva
    // para que no se "pierdan" al cambiar el día. No es crítico si falla.
    if (antes !== despues) {
      try {
        await useConvocatoriaStore.getState().migrar(antes, despues)
      } catch {
        /* el admin puede reintentar cambiando la fecha de nuevo */
      }
    }
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
