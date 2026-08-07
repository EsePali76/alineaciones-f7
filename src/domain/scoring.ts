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
 * Influencia MÁXIMA (en puntos de score) del estado de ánimo sobre la nota final.
 * El ánimo es 0-10 con base 5; el modificador = (animo-5)/5 * ANIMO_MAX_DELTA,
 * así que va de -0.5 (ánimo 0) a +0.5 (ánimo 10). Influencia pequeña, a propósito.
 */
export const ANIMO_MAX_DELTA = 0.5

export interface ScoreOptions {
  weights?: ScoreWeights
  /**
   * Ánimo calculado del jugador (0-10) para aplicar el modificador suave.
   * `undefined` = sin efecto (aún no hay historial / no se quiere aplicar).
   */
  animo?: number
  animoMaxDelta?: number
  /** Método de ponderación. Por defecto `valoraciones` (el de siempre). */
  metodo?: MetodoEquilibrado
  /** Nota 0-10 por resultados de cada jugador. La usan `resultados` y `mixto`. */
  puntos?: Map<string, number>
}

/**
 * Media PONDERADA de las valoraciones (sin el modificador de ánimo): el "nivel base"
 * del jugador. Es lo que muestra también la columna "Valoración" del Plantel.
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
 * Puntaje de un jugador en escala 0-10, para el reparto. Qué se usa de base depende
 * del método elegido en la pantalla de Equipos:
 * - `valoraciones` (por defecto): media ponderada de lo que vota el grupo (ver
 *   `weightedRatings`), MÁS el modificador suave de ánimo (±ANIMO_MAX_DELTA).
 * - `resultados`: la nota que sale de sus victorias y derrotas, y nada más.
 * - `mixto`: la media de las dos bases anteriores, sin ánimo.
 *
 * NOTA: la edad NO entra directamente en el puntaje a propósito. Su efecto real
 * (menos chispa, menos físico) ya lo recogen las valoraciones de velocidad y físico,
 * así que sumarla otra vez sería contarla dos veces. Se guarda solo como dato.
 */
export function playerScore(player: Player, opts: ScoreOptions = {}): number {
  if (opts.metodo === 'resultados') return resultadosScore(player, opts)
  if (opts.metodo === 'mixto') return mixtoScore(player, opts)

  const weights = opts.weights ?? DEFAULT_WEIGHTS
  let score = weightedRatings(player, weights)

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
 * Puntaje por RESULTADOS: la nota 0-10 que sale de sus victorias y derrotas y NADA
 * MÁS (ver `notasPorResultados`).
 *
 * SIN EL MODIFICADOR DE ÁNIMO, a propósito: sale de los mismos partidos que la
 * propia nota, así que sumarlo haría que lo reciente contase dos veces con un peso
 * que nadie ha decidido. Si algún día se quiere que lo reciente pese más, va DENTRO
 * de la fórmula (un decaimiento explícito), no como término aparte.
 *
 * Un jugador sin partidos (invitado nuevo, alta reciente) vale 5, el centro de la
 * escala: no hay nada que le suba ni que le baje.
 */
function resultadosScore(player: Player, opts: ScoreOptions): number {
  return opts.puntos?.get(player.id) ?? DEFAULT_RATING
}

/**
 * Puntaje MIXTO: la media simple de las dos bases anteriores, la votada y la ganada
 * en el campo. Ambas están en escala 0-10, así que se promedian directamente.
 *
 * Sin ánimo, igual que el de resultados: la mitad de esta base ya son resultados, y
 * el ánimo sale de esos mismos partidos.
 *
 * A medias exactas (50/50), no ponderado. Si algún día se quiere inclinar la balanza
 * hacia un lado, este es el sitio — pero conviene decidirlo con los datos de la
 * comparativa de métodos, no a ojo.
 */
function mixtoScore(player: Player, opts: ScoreOptions): number {
  const valoraciones = weightedRatings(player, opts.weights ?? DEFAULT_WEIGHTS)
  const resultados = opts.puntos?.get(player.id) ?? DEFAULT_RATING
  return (valoraciones + resultados) / 2
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
