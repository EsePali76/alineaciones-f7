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
  /** Ventana global de re-evaluación abierta (todos pueden revisar sus votos). */
  ratingsOpen: boolean
  /** Override de fecha del próximo partido ('YYYY-MM-DD'); null = automática. */
  matchDate: string | null
  loaded: boolean
  load: () => Promise<void>
  /** "Este lunes no hay partido": empuja la fecha al siguiente lunes (admin). NO toca la cola. */
  posponerJornada: (nuevaFecha: string) => Promise<void>
  /** Pasa turno (lo llama el del turno) o avanza (admin). Conserva el sitio del que pasa. */
  pasarTurno: () => Promise<void>
  /** Siembra/reinicia la cola con los elegibles actuales (admin). */
  reiniciar: () => Promise<void>
  /** Tras confirmar una alineación: el autor va al final y empieza ciclo nuevo. */
  alConfirmar: (doerId: string) => Promise<void>
  /** Abre/cierra el plazo de re-evaluación de valoraciones (admin). */
  setRatingsOpen: (open: boolean) => Promise<void>
}

async function persist(set: (p: Partial<RotationState>) => void, data: RotationData) {
  set({ data })
  await api.saveRotation(data)
}

export const useRotationStore = create<RotationState>((set, get) => ({
  data: { currentPlayerId: null, orderIds: [], skippedIds: [] },
  ratingsOpen: false,
  matchDate: null,
  loaded: false,

  load: async () => {
    const { rotation, ratingsOpen, matchDate } = await api.fetchRotation()
    set({ data: rotation, ratingsOpen, matchDate, loaded: true })
  },

  posponerJornada: async (nuevaFecha) => {
    const prev = get().matchDate
    set({ matchDate: nuevaFecha })
    try {
      await api.saveMatchDate(nuevaFecha)
    } catch (e) {
      set({ matchDate: prev })
      throw e
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
}))
