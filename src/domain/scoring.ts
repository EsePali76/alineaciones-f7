import type { Player, PositionCode } from './types'
import { DEFAULT_RATING, RATING_KEYS } from './constants'
import type { MetodoEquilibrado } from './resultados'

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
 * así que va de -0.5 (ánimo 0) a +0.5 (ánimo 10). Influencia pequeña, a propósito.
 */
export const ANIMO_MAX_DELTA = 0.5

/**
 * Penalización por ir "tocado" en el método de RESULTADOS, en puntos.
 * Aquí NO vale el factor multiplicativo del método de valoraciones: la puntuación
 * por resultados puede ser negativa, y multiplicar -4 por 0.82 daría -3.28, o sea
 * que ir tocado MEJORARÍA la nota. Por eso se resta. 1.0 = "como haber perdido un
 * partido más". Ajustable.
 */
export const TOCADO_PENALTY_RESULTADOS = 1.0

export interface ScoreOptions {
  weights?: ScoreWeights
  tocadoFactor?: number
  /**
   * Ánimo calculado del jugador (0-10) para aplicar el modificador suave.
   * `undefined` = sin efecto (aún no hay historial / no se quiere aplicar).
   */
  animo?: number
  animoMaxDelta?: number
  /** Método de ponderación. Por defecto `valoraciones` (el de siempre). */
  metodo?: MetodoEquilibrado
  /** Puntos por resultados (V-D) por jugador. Solo se usa con `metodo: 'resultados'`. */
  puntos?: Map<string, number>
  /** Penalización de "tocado" en el método de resultados. */
  tocadoPenalty?: number
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
  if (opts.metodo === 'resultados') return resultadosScore(player, opts)

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

/**
 * Puntaje por RESULTADOS: los puntos que lleva el jugador (+1 victoria, 0 empate,
 * -1 derrota), penalizados si viene tocado y matizados por el ánimo.
 *
 * Un jugador sin historial (invitado nuevo, alta reciente) vale 0, que es justo el
 * centro de la escala: ni suma ni resta. No hay que rellenarle nada.
 *
 * SÍ se aplica el ánimo, aunque salga de los mismos partidos. No es contarlo dos
 * veces: la suma es PLANA (el partido de hace dos meses vale igual que el del
 * lunes) y el ánimo lleva decaimiento, así que lo que aporta es la RECENCIA, que
 * esta métrica no tiene por ningún otro lado. Además cuenta el MVP, que aquí no
 * entra. Sigue siendo un matiz de ±0.5 puntos.
 */
function resultadosScore(player: Player, opts: ScoreOptions): number {
  let score = opts.puntos?.get(player.id) ?? 0
  if (player.tocado) score -= opts.tocadoPenalty ?? TOCADO_PENALTY_RESULTADOS

  const animo = opts.animo ?? player.animoCalculado
  if (animo != null) score += ((animo - 5) / 5) * (opts.animoMaxDelta ?? ANIMO_MAX_DELTA)

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
