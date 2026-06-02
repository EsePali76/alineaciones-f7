import type { ConfirmedLineup } from './types'

/**
 * Estado de ánimo AUTOMÁTICO (0-10), calculado de la racha de resultados.
 * Por partido, el ánimo de cada jugador se mueve así:
 *   - MVP del partido (jugador del equipo ganador con más goles+asistencias,
 *     si es claramente el primero): +1.0
 *   - Resto de ganadores: +0.5
 *   - Perdedores: -0.5
 *   - Empate: 0
 * Base 5, acotado 0-10. Los partidos recientes pesan más (decaimiento).
 * No se vota ni se edita: solo es visible. Afecta poco al puntaje (modificador ±0.3).
 */
const DELTA_MVP = 1.0
const DELTA_GANA = 0.5
const DELTA_PIERDE = -0.5
const DECAY = 0.7
const BASE = 5

function jugo(l: ConfirmedLineup, playerId: string): boolean {
  return l.teamA.includes(playerId) || l.teamB.includes(playerId)
}

/**
 * MVP del partido: jugador del equipo GANADOR con más (goles + asistencias), siempre
 * que sea claramente el primero (>0 y sin empate en lo más alto). null si no hay claro.
 */
export function mvpDelPartido(l: ConfirmedLineup): string | null {
  const r = l.resultado
  if (!r || r.golesA === r.golesB) return null
  const ganadores = r.golesA > r.golesB ? l.teamA : l.teamB
  const goleadores = r.goleadores ?? {}
  const asistencias = r.asistencias ?? {}
  const ranking = ganadores
    .map((id) => ({
      id,
      c: (goleadores[id] ?? 0) + (asistencias[id] ?? 0),
      g: goleadores[id] ?? 0,
    }))
    .sort((a, b) => b.c - a.c || b.g - a.g)
  const top = ranking[0]
  if (!top || top.c <= 0) return null
  const segundo = ranking[1]
  // Empate en lo más alto (misma contribución y mismos goles) → no hay MVP claro.
  if (segundo && segundo.c === top.c && segundo.g === top.g) return null
  return top.id
}

/** MVP efectivo: el asignado a mano por el admin si lo hay; si no, el automático. */
export function mvpEfectivo(l: ConfirmedLineup): string | null {
  return l.resultado?.mvp ?? mvpDelPartido(l)
}

/** Variación de ánimo de un jugador en un partido concreto. */
function deltaDe(l: ConfirmedLineup, playerId: string): number {
  const r = l.resultado
  if (!r) return 0
  // El MVP (manual o automático) siempre suma +1, gane, pierda o empate.
  if (mvpEfectivo(l) === playerId) return DELTA_MVP
  if (r.golesA === r.golesB) return 0 // empate
  const enA = l.teamA.includes(playerId)
  const gano = enA ? r.golesA > r.golesB : r.golesB > r.golesA
  return gano ? DELTA_GANA : DELTA_PIERDE
}

/** Ánimo calculado (0-10) de un jugador a partir del historial con resultados. */
export function computeAnimo(playerId: string, lineups: ConfirmedLineup[]): number {
  const jugados = lineups
    .filter((l) => l.resultado && jugo(l, playerId))
    .sort((a, b) => b.fecha - a.fecha)
  let sum = 0
  jugados.forEach((l, i) => {
    sum += deltaDe(l, playerId) * Math.pow(DECAY, i)
  })
  return Math.max(0, Math.min(10, BASE + sum))
}

/** Etiqueta + emoji orientativos para un valor de ánimo. */
export function animoLabel(v: number): { emoji: string; texto: string } {
  if (v >= 6.5) return { emoji: '😀', texto: 'Animado' }
  if (v >= 5.5) return { emoji: '🙂', texto: 'Bien' }
  if (v > 4.5) return { emoji: '😐', texto: 'Normal' }
  if (v > 3.5) return { emoji: '😕', texto: 'Tocado' }
  return { emoji: '😞', texto: 'Bajo' }
}
