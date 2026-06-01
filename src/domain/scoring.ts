import type { Player, PositionCode } from './types'
import { DEFAULT_RATING, RATING_KEYS } from './constants'

/**
 * Pesos de cada valoración en el puntaje del jugador. Suman 1.
 * Calidad y velocidad pesan más (son las que más marcan diferencias en F7).
 * AJUSTABLES: si veis que un parámetro pesa de más/menos, se tocan aquí.
 */
export interface ScoreWeights {
  tecnica: number
  disparo: number
  presion: number
  velocidad: number
  fisico: number
  forma: number
  animo: number
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  tecnica: 0.2,
  disparo: 0.15,
  presion: 0.15,
  velocidad: 0.15,
  fisico: 0.15,
  forma: 0.1,
  animo: 0.1,
}

/**
 * Factor que multiplica el puntaje de un jugador "tocado / en baja forma".
 * 0.85 = rinde al ~85% de su nivel ese día. Ajustable.
 */
export const TOCADO_FACTOR = 0.85

export interface ScoreOptions {
  weights?: ScoreWeights
  tocadoFactor?: number
}

/**
 * Puntaje de un jugador en escala ~1-5.
 * - Valoraciones sin rellenar se asumen a la media (3), tanto para invitados como
 *   para cualquier hueco vacío, para no falsear el reparto.
 * - Si el jugador va "tocado", se aplica el factor de penalización.
 *
 * NOTA: la edad NO entra directamente en el puntaje a propósito. Su efecto real
 * (menos chispa, menos físico) ya lo recogen las valoraciones de velocidad y físico,
 * así que sumarla otra vez sería contarla dos veces. Se guarda solo como dato.
 */
export function playerScore(player: Player, opts: ScoreOptions = {}): number {
  const weights = opts.weights ?? DEFAULT_WEIGHTS
  const tocadoFactor = opts.tocadoFactor ?? TOCADO_FACTOR

  let score = 0
  for (const key of RATING_KEYS) {
    const value = player.ratings[key] ?? DEFAULT_RATING
    score += value * weights[key]
  }

  if (player.tocado) score *= tocadoFactor

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
