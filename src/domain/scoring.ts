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

/**
 * Factor que multiplica el puntaje de un jugador "tocado / bajo de forma".
 * 0.82 = rinde al ~82% de su nivel ese día (≈18% menos). Ajustable.
 */
export const TOCADO_FACTOR = 0.82

/**
 * Influencia MÁXIMA (en puntos de score) del estado de ánimo sobre la nota final.
 * El ánimo es 0-10 con base 5; el modificador = (animo-5)/5 * ANIMO_MAX_DELTA,
 * así que va de -0.3 (ánimo 0) a +0.3 (ánimo 10). Influencia mínima, a propósito.
 */
export const ANIMO_MAX_DELTA = 0.3

export interface ScoreOptions {
  weights?: ScoreWeights
  tocadoFactor?: number
  /**
   * Ánimo calculado del jugador (0-10) para aplicar el modificador suave.
   * `undefined` = sin efecto (aún no hay historial / no se quiere aplicar).
   */
  animo?: number
  animoMaxDelta?: number
}

/**
 * Media PONDERADA de las valoraciones (sin tocado ni ánimo): el "nivel base" del
 * jugador. Es lo que muestra también la columna "Valoración" del Plantel.
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
 * Puntaje de un jugador en escala ~0-10, para el reparto: media ponderada (ver
 * `weightedRatings`) + modificadores de situación:
 * - Si va "tocado / bajo de forma", factor de penalización (~18% menos).
 * - El ánimo (si se pasa) aplica un modificador suave de ±ANIMO_MAX_DELTA puntos.
 *
 * NOTA: la edad NO entra directamente en el puntaje a propósito. Su efecto real
 * (menos chispa, menos físico) ya lo recogen las valoraciones de velocidad y físico,
 * así que sumarla otra vez sería contarla dos veces. Se guarda solo como dato.
 */
export function playerScore(player: Player, opts: ScoreOptions = {}): number {
  const weights = opts.weights ?? DEFAULT_WEIGHTS
  const tocadoFactor = opts.tocadoFactor ?? TOCADO_FACTOR

  let score = weightedRatings(player, weights)

  if (player.tocado) score *= tocadoFactor

  // Modificador suave de ánimo (automático): influencia mínima.
  // Usa el ánimo de opciones o, si no, el calculado y adjuntado al jugador.
  const animo = opts.animo ?? player.animoCalculado
  if (animo != null) {
    const delta = opts.animoMaxDelta ?? ANIMO_MAX_DELTA
    score += ((animo - 5) / 5) * delta
  }

  return score
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
