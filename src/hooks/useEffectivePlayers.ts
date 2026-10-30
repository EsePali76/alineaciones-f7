import { useMemo } from 'react'
import { usePlayersStore } from '../store/playersStore'
import { useRatingsStore } from '../store/ratingsStore'
import { useLineupsStore } from '../store/lineupsStore'
import { useRotationStore } from '../store/rotationStore'
import { computeAnimo } from '../domain/animo'
import { BASE_COMUN, simularAjustes, type SimulacionAjustes } from '../domain/ajuste'
import type { Player } from '../domain/types'

/**
 * Jugadores con las valoraciones del grupo resueltas y la simulación del ajuste por
 * resultados (totales por jugador + detalle de cada partido). Base común de
 * `useEffectivePlayers` y `useSimulacionAjustes`.
 */
function useConAjustes(): { conVotos: Player[]; sim: SimulacionAjustes; baseCincoDesde: number | null } {
  const players = usePlayersStore((s) => s.players)
  const averages = useRatingsStore((s) => s.averages)
  const lineups = useLineupsStore((s) => s.lineups)
  const eloK = useRotationStore((s) => s.eloK)
  const baseCincoDesde = useRotationStore((s) => s.baseCincoDesde)
  return useMemo(() => {
    const conVotos = players.map((p) => {
      const avg = averages.get(p.id)
      const ratings =
        avg && avg.numVotos > 0 && Object.keys(avg.values).length > 0 ? avg.values : p.ratings
      return { ...p, ratings, animoCalculado: computeAnimo(p.id, lineups) }
    })
    // El ajuste necesita las valoraciones ya resueltas (nivel de cada equipo).
    const sim = simularAjustes(lineups, conVotos, eloK, baseCincoDesde)
    return { conVotos, sim, baseCincoDesde }
  }, [players, averages, lineups, eloK, baseCincoDesde])
}

/**
 * Jugadores con sus valoraciones = MEDIAS colaborativas cuando existen votos
 * (fallback a los datos sembrados si aún no hay votos) y con el ÁNIMO calculado
 * adjunto (derivado de los resultados, solo informativo) y el AJUSTE por resultados
 * (que sí entra en la nota; ver `domain/ajuste.ts`).
 *
 * Es lo que deben consumir el plantel (display) y el generador (algoritmo); el
 * formulario de admin sigue editando el jugador "crudo" (semilla/identidad).
 */
export function useEffectivePlayers(): Player[] {
  const { conVotos, sim, baseCincoDesde } = useConAjustes()
  return useMemo(() => {
    // «Todos parten de 5»: el reparto usa 5 + ajuste; `ratings` sigue siendo la del grupo.
    const baseReparto = baseCincoDesde != null ? BASE_COMUN : undefined
    return conVotos.map((p) => ({ ...p, ajuste: sim.jugadores.get(p.id)?.total ?? 0, baseReparto }))
  }, [conVotos, sim, baseCincoDesde])
}

/**
 * Simulación del ajuste: lo que lleva cada jugador y, por partido, nivel de cada
 * equipo, probabilidad de victoria, Δ de cada jugador y su nota después.
 */
export function useSimulacionAjustes(): SimulacionAjustes {
  return useConAjustes().sim
}
