import { useMemo } from 'react'
import { usePlayersStore } from '../store/playersStore'
import { useRotationStore } from '../store/rotationStore'
import { useLineupsStore } from '../store/lineupsStore'
import { useAuthStore } from '../store/authStore'
import { effectiveCurrent, esElegibleRotacion, nextCurrent } from '../domain/rotation'
import { partidoPasado } from '../domain/matchday'
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
  /**
   * ¿Está el turno "congelado"? La alineación de la jornada en curso ya está hecha,
   * así que el relevo no se anuncia hasta el día siguiente al partido (a la vez que
   * caduca la convocatoria). Mientras tanto `current` sigue siendo su autor.
   */
  congelado: boolean
  /** Id del turno REAL en la cola (sin congelar). Para decidir avances de la rotación. */
  currentColaId: string | null
}

/** Calcula a quién le toca hacer la alineación, de forma robusta a bajas/exclusiones. */
export function useTurno(): TurnoInfo {
  const players = usePlayersStore((s) => s.players)
  const data = useRotationStore((s) => s.data)
  const lineups = useLineupsStore((s) => s.lineups)
  const myPlayerId = useAuthStore((s) => s.profile?.playerId ?? null)

  return useMemo(() => {
    const eligible = new Set(players.filter(esElegibleRotacion).map((p) => p.id))
    const currentColaId = effectiveCurrent(data, eligible)
    const nextColaId = nextCurrent(data, eligible)

    // Alineación de la jornada en curso (hecha, con o sin resultado ya registrado).
    // Mientras el partido no haya pasado, el turno sigue siendo de quien la hizo: el
    // relevo salta al día siguiente, justo cuando se resetea la convocatoria.
    const jornadaHecha = lineups
      .filter((l) => l.madeBy && !partidoPasado(l.fecha))
      .sort((a, b) => b.fecha - a.fecha)[0]
    const congelado = !!jornadaHecha?.madeBy && eligible.has(jornadaHecha.madeBy)

    const currentId = congelado ? jornadaHecha.madeBy! : currentColaId
    // Congelado y la cola YA avanzó (resultado registrado): el "próximo" es el que
    // está de turno en la cola, o sea el relevo pendiente de anunciarse. En el resto
    // de casos, el siguiente simulado de la cola.
    const nextId = congelado && currentColaId !== currentId ? currentColaId : nextColaId

    const byId = (id: string | null) => (id ? players.find((p) => p.id === id) ?? null : null)
    return {
      current: byId(currentId),
      next: byId(nextId),
      isMyTurn: !!myPlayerId && myPlayerId === currentId,
      vacia: eligible.size === 0,
      congelado,
      currentColaId,
    }
  }, [players, data, lineups, myPlayerId])
}
