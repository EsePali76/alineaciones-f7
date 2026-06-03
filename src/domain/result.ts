import type { MatchResult } from './types'

/**
 * Goleadores por jugador (playerId → nº de goles). Usa la lista `goles` (modelo
 * nuevo) si existe; si no, cae a los contadores legados `goleadores`.
 */
export function goleadoresDe(r: MatchResult): Record<string, number> {
  if (r.goles) {
    const m: Record<string, number> = {}
    for (const g of r.goles) if (g.autor) m[g.autor] = (m[g.autor] ?? 0) + 1
    return m
  }
  return r.goleadores ?? {}
}

/**
 * Asistencias por jugador (playerId → nº). Usa la lista `goles` si existe; si no,
 * cae a los contadores legados `asistencias`.
 */
export function asistenciasDe(r: MatchResult): Record<string, number> {
  if (r.goles) {
    const m: Record<string, number> = {}
    for (const g of r.goles) if (g.asistente) m[g.asistente] = (m[g.asistente] ?? 0) + 1
    return m
  }
  return r.asistencias ?? {}
}
