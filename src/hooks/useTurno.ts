import { useMemo } from 'react'
import { usePlayersStore } from '../store/playersStore'
import { useRotationStore } from '../store/rotationStore'
import { useAuthStore } from '../store/authStore'
import { effectiveCurrent, nextCurrent } from '../domain/rotation'
import type { Player } from '../domain/types'

export interface TurnoInfo {
  /** Jugador al que le toca hacer la alineación esta semana (o null). */
  current: Player | null
  /** Jugador al que le tocará la PRÓXIMA (para avisar con antelación). */
  next: Player | null
  /** ¿Le toca al usuario actual? */
  isMyTurn: boolean
  /** ¿Está vacía/sin inicializar la rotación? (no hay elegibles o sin sembrar) */
  vacia: boolean
}

/** Calcula a quién le toca hacer la alineación, de forma robusta a bajas/exclusiones. */
export function useTurno(): TurnoInfo {
  const players = usePlayersStore((s) => s.players)
  const data = useRotationStore((s) => s.data)
  const myPlayerId = useAuthStore((s) => s.profile?.playerId ?? null)

  return useMemo(() => {
    const eligible = new Set(
      players.filter((p) => p.activo && !p.excluidoRotacion && !p.reserva).map((p) => p.id),
    )
    const currentId = effectiveCurrent(data, eligible)
    const current = currentId ? players.find((p) => p.id === currentId) ?? null : null
    const nextId = nextCurrent(data, eligible)
    const next = nextId ? players.find((p) => p.id === nextId) ?? null : null
    return {
      current,
      next,
      isMyTurn: !!myPlayerId && myPlayerId === currentId,
      vacia: eligible.size === 0,
    }
  }, [players, data, myPlayerId])
}
