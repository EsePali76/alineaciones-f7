import type { Player, PositionCode } from './types'
import { DEFAULT_RATING, RATING_KEYS } from './constants'

/**
 * Pesos de cada valoración en el puntaje del jugador. Suman 1.
 * "general" es el ancla (juicio holístico de lo buen futbolista que es) y pesa
 * bastante más; las facetas matizan; los físicos son modificadores. Esto endereza
 * el ranking (evita que el atlético-limitado adelante al buen futbolista).
 * AJUSTABLES: si veis que un parámetro pesa de más/menos, se tocan aquí.
 */
export interface ScoreWeights {
  general: number
  definicion: number
  criterio: number
  tecnica: number
  defensa: number
  velocidad: number
  fisico: number
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  general: 0.34,
  definicion: 0.12,
  criterio: 0.12,
  tecnica: 0.12,
  defensa: 0.1,
  velocidad: 0.1,
  fisico: 0.1,
}

export interface ScoreOptions {
  weights?: ScoreWeights
}

/**
 * Media PONDERADA de las valoraciones: el "nivel base" del jugador, lo que vota el
 * grupo. Es lo que muestra también la columna "Valoración" del Plantel.
 *
 * Relleno de huecos: una faceta sin valorar toma el valor de la "general" (el juicio
 * de conjunto); si tampoco hay general, se usa 5. Así, valorar solo la general da
 * exactamente esa nota, y rellenar facetas concretas solo matiza desde ahí.
 */
export function weightedRatings(player: Player, weights: ScoreWeights = DEFAULT_WEIGHTS): number {
  const general = player.ratings.general ?? DEFAULT_RATING
  let score = 0
  for (const key of RATING_KEYS) {
    const value = key === 'general' ? general : player.ratings[key] ?? general
    score += value * weights[key]
  }
  return score
}

/**
 * Puntaje de un jugador en escala 0-10, para el reparto: la valoración del grupo
 * (`weightedRatings`) MÁS el ajuste por resultados (`domain/ajuste.ts`), que adjunta
 * `useEffectivePlayers`.
 *
 * Antes había tres métodos (valoraciones / resultados / mixto) y un modificador de
 * ánimo de ±0,5. Se quitaron el 2026-10-22: el ajuste ya mide los resultados, y con
 * el ánimo se contarían dos veces. El ánimo queda solo como dato informativo.
 *
 * NOTA: la edad NO entra directamente en el puntaje a propósito. Su efecto real
 * (menos chispa, menos físico) ya lo recogen las valoraciones de velocidad y físico,
 * así que sumarla otra vez sería contarla dos veces. Se guarda solo como dato.
 */
export function playerScore(player: Player, opts: ScoreOptions = {}): number {
  return weightedRatings(player, opts.weights ?? DEFAULT_WEIGHTS) + (player.ajuste ?? 0)
}

/** Líneas de campo a grandes rasgos, para equilibrar el reparto por zonas. */
export type Linea = 'DEF' | 'MED' | 'ATA'

const LINEA_DE_POSICION: Record<PositionCode, Linea> = {
  POR: 'DEF',
  DEF: 'DEF',
  CAR: 'DEF',
  MED: 'MED',
  MP: 'MED',
  EXT: 'ATA',
  DEL: 'ATA',
}

/**
 * Línea principal del jugador. Se toma su PRIMERA posición como la principal
 * (el admin pone primero la que más juega).
 */
export function lineaPrincipal(player: Player): Linea {
  const principal = player.posiciones[0]
  return principal ? LINEA_DE_POSICION[principal] : 'MED'
}

/** True si el jugador es zurdo (para repartir zurdos entre equipos). */
export function esZurdo(player: Player): boolean {
  return player.pierna === 'izq'
}
