import { create } from 'zustand'
import * as api from '../lib/rotationApi'
import {
  advanceAfterConfirm,
  advancePass,
  seed,
  type RotationData,
} from '../domain/rotation'
import { usePlayersStore } from './playersStore'

/** Ids de jugadores elegibles para la rotación, en orden estable (por antigüedad). */
function eligibleOrdered(): string[] {
  return usePlayersStore
    .getState()
    .players.filter((p) => p.activo && !p.excluidoRotacion)
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
  loaded: boolean
  load: () => Promise<void>
  /** Pasa turno (lo llama el del turno) o avanza (admin). Conserva el sitio del que pasa. */
  pasarTurno: () => Promise<void>
  /** Siembra/reinicia la cola con los elegibles actuales (admin). */
  reiniciar: () => Promise<void>
  /** Tras confirmar una alineación: el autor va al final y empieza ciclo nuevo. */
  alConfirmar: (doerId: string) => Promise<void>
}

async function persist(set: (p: Partial<RotationState>) => void, data: RotationData) {
  set({ data })
  await api.saveRotation(data)
}

export const useRotationStore = create<RotationState>((set, get) => ({
  data: { currentPlayerId: null, orderIds: [], skippedIds: [] },
  loaded: false,

  load: async () => {
    const data = await api.fetchRotation()
    set({ data, loaded: true })
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
}))
