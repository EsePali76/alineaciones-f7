import { useMemo } from 'react'
import { usePlayersStore } from '../store/playersStore'
import { useRatingsStore } from '../store/ratingsStore'
import { useLineupsStore } from '../store/lineupsStore'
import { computeAnimo } from '../domain/animo'
import type { Player } from '../domain/types'

/**
 * Jugadores con sus valoraciones = MEDIAS colaborativas cuando existen votos
 * (fallback a los datos sembrados si aún no hay votos) y con el ÁNIMO calculado
 * adjunto (derivado de los resultados).
 *
 * Es lo que deben consumir el plantel (display) y el generador (algoritmo); el
 * formulario de admin sigue editando el jugador "crudo" (semilla/identidad).
 */
export function useEffectivePlayers(): Player[] {
  const players = usePlayersStore((s) => s.players)
  const averages = useRatingsStore((s) => s.averages)
  const lineups = useLineupsStore((s) => s.lineups)
  return useMemo(
    () =>
      players.map((p) => {
        const avg = averages.get(p.id)
        const ratings =
          avg && avg.numVotos > 0 && Object.keys(avg.values).length > 0 ? avg.values : p.ratings
        return { ...p, ratings, animoCalculado: computeAnimo(p.id, lineups) }
      }),
    [players, averages, lineups],
  )
}
