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
import { DIAS_PARTIDO_DEFECTO, fechaEfectiva } from '../domain/matchday'
import { K_DEFECTO } from '../domain/ajuste'

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
   * Días fijos de partido (0 domingo … 6 sábado), uno o varios por semana. Los
   * cambian admin y superuser desde el banner. `matchDate` (override de un partido
   * suelto) manda sobre ellos.
   */
  matchWeekdays: number[]
  /** K vigente del ajuste por resultados (la configura el admin en «Usuarios»). */
  eloK: number
  /** Desde cuándo (ms) todos parten de 5 para el reparto; null = valoración del grupo. */
  baseCincoDesde: number | null
  loaded: boolean
  load: () => Promise<void>
  /** "Este partido no se juega": empuja la fecha a la jornada siguiente (admin). NO toca la cola. */
  posponerJornada: (nuevaFecha: string) => Promise<void>
  /** Fija una fecha arbitraria para el próximo partido, o null para volver al automático (admin). */
  fijarFecha: (fechaISO: string | null) => Promise<void>
  /** Cambia los días fijos de partido (admin/superuser). NO toca la cola de turnos. */
  fijarDiasSemana: (dows: number[]) => Promise<void>
  /** Cambia la K del ajuste por resultados (admin). Solo afecta a los resultados que se registren después. */
  setEloK: (k: number) => Promise<void>
  /** Activa (true → desde ahora) o desactiva «todos parten de 5» (admin). */
  setBaseCinco: (on: boolean) => Promise<void>
  /**
   * Pasa turno (lo llama el del turno) o avanza (admin). Conserva el sitio del que pasa.
   * `turnoId` = el de turno según `useTurno` (con el filtro de valoraciones aplicado).
   */
  pasarTurno: (turnoId?: string | null) => Promise<void>
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
  matchWeekdays: [...DIAS_PARTIDO_DEFECTO],
  eloK: K_DEFECTO,
  baseCincoDesde: null,
  loaded: false,

  load: async () => {
    const { rotation, ratingsOpen, ratingsDeadline, requireRatings, matchDate, matchWeekdays } =
      await api.fetchRotation()
    const eloK = await api.fetchEloK()
    const baseCincoDesde = await api.fetchBaseCincoDesde()
    set({
      eloK,
      baseCincoDesde,
      data: rotation,
      ratingsOpen,
      ratingsDeadline,
      requireRatings,
      matchDate,
      matchWeekdays,
      loaded: true,
    })
  },

  posponerJornada: async (nuevaFecha) => {
    await get().fijarFecha(nuevaFecha)
  },

  fijarFecha: async (fechaISO) => {
    const prev = get().matchDate
    const dows = get().matchWeekdays
    const antes = fechaEfectiva(prev, dows)
    const despues = fechaEfectiva(fechaISO, dows)
    set({ matchDate: fechaISO })
    try {
      await api.saveMatchDate(fechaISO)
    } catch (e) {
      set({ matchDate: prev })
      throw e
    }
    await migrarConvocados(antes, despues)
  },

  fijarDiasSemana: async (dows) => {
    const prev = get().matchWeekdays
    if (dows.length === 0) return // siempre queda al menos un día de partido
    if (dows.length === prev.length && dows.every((d) => prev.includes(d))) return
    const override = get().matchDate
    const antes = fechaEfectiva(override, prev)
    set({ matchWeekdays: dows })
    try {
      await api.setMatchWeekdays(dows)
    } catch (e) {
      set({ matchWeekdays: prev })
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
    await migrarConvocados(antes, fechaEfectiva(get().matchDate, dows))
  },

  setEloK: async (k) => {
    const prev = get().eloK
    set({ eloK: k })
    try {
      await api.setEloK(k)
    } catch (e) {
      set({ eloK: prev })
      throw e
    }
  },

  setBaseCinco: async (on) => {
    const prev = get().baseCincoDesde
    const desde = on ? Date.now() : null
    set({ baseCincoDesde: desde })
    try {
      await api.setBaseCincoDesde(desde)
    } catch (e) {
      set({ baseCincoDesde: prev })
      throw e
    }
  },

  pasarTurno: async (turnoId) => {
    const next = advancePass(get().data, eligibleOrdered(), turnoId)
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
