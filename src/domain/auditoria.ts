import { probabilidadEquipos } from './ajuste'
import type { ConfirmedLineup, Player } from './types'

/**
 * Transparencia de una alineación: si es la propuesta de la app o cuánto la retocó
 * quien alinea, y quién es su autor final (ver `components/InfoAlineacion.tsx`).
 */

/** «⚪ 58% · 🔴 42%» a partir de la probabilidad de victoria de A. */
export function porcentajes(probA: number): string {
  const a = Math.round(probA * 100)
  return `⚪ ${a}% · 🔴 ${100 - a}%`
}

/**
 * Retoques respecto a la propuesta de la app: nº de jugadores que han pasado de un
 * equipo a otro (el mismo en los dos) y la probabilidad de A de la propuesta. null si
 * no hay propuesta o no casa con los jugadores de la alineación.
 */
export function auditarAlineacion(
  propuesta: { teamA: string[]; teamB: string[] } | null | undefined,
  finA: string[],
  finB: string[],
  players: Player[],
): { cambios: number; probAppA: number } | null {
  if (!propuesta) return null
  const todos = new Set([...finA, ...finB])
  if (
    propuesta.teamA.length + propuesta.teamB.length !== todos.size ||
    ![...propuesta.teamA, ...propuesta.teamB].every((id) => todos.has(id))
  )
    return null
  const porId = new Map(players.map((p) => [p.id, p]))
  const aPlayers = (ids: string[]) => ids.map((id) => porId.get(id)).filter((p): p is Player => !!p)
  const propA = new Set(propuesta.teamA)
  return {
    cambios: finA.filter((id) => !propA.has(id)).length,
    probAppA: probabilidadEquipos(aPlayers(propuesta.teamA), aPlayers(propuesta.teamB)),
  }
}

/**
 * Autor FINAL de una alineación (para estadísticas y para el nombre en la imagen):
 * quien confirmó los equipos por última vez. Distinto de `madeBy`, que es el del
 * turno y es lo que mueve la cola. Las antiguas, sin `autor`, son de `madeBy`.
 */
export function autorDe(l: ConfirmedLineup): string | undefined {
  return l.autor ?? l.madeBy
}
