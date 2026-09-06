import type { ConfirmedLineup } from './types'
import { anioTemporada } from './season'

/**
 * Método de ponderación con el que se equilibran los equipos. Se elige en la
 * pantalla de Equipos antes de generar.
 * - `valoraciones`: el de siempre. Media ponderada de lo que vota el grupo, más el
 *   modificador de ánimo.
 * - `resultados`: solo lo que ha pasado en el campo (ver `notasPorResultados`).
 * - `mixto`: la media de las dos bases anteriores, sin ánimo.
 *
 * Los tres comparten los términos secundarios de la función de coste (líneas,
 * zurdos y repetición de parejas): eso no depende del método.
 */
export type MetodoEquilibrado = 'valoraciones' | 'resultados' | 'mixto'

/**
 * Partidos "fantasma" que se suman al divisor para amortiguar a los de poca muestra.
 *
 * POR QUÉ NO LA MEDIA PELADA: con (V-D)/partidos, el que vino UN día y ganó saca
 * 1,0 clavado —el máximo posible— y se pone por delante de todo el mundo. Con pocos
 * partidos la media es inestable. Al dividir por (partidos + 3), ese mismo jugador
 * saca 0,25: hay que acumular partidos para acercarse a los extremos.
 *
 * A los fijos casi no les afecta (con 8-9 partidos ya pesan lo suyo); a quien
 * corrige de verdad es al invitado ocasional, que es justo donde está el problema.
 */
export const PARTIDOS_FANTASMA = 3

/** Nota neutra: ni gana ni pierde más de la cuenta. Es el centro de la escala 0-10. */
const NOTA_NEUTRA = 5

/**
 * Cuánto pesa un partido de la TEMPORADA ANTERIOR frente a uno de la actual.
 *
 * POR QUÉ NO SOLO LA TEMPORADA EN CURSO: en septiembre el historial de la temporada
 * nueva está vacío, así que todo el mundo valdría 5 y este método repartiría al azar
 * durante las primeras jornadas —justo cuando ya sabemos perfectamente quién ganó
 * qué el año pasado—. Y por qué no todo el historial: porque entonces un jugador
 * arrastra para siempre resultados de hace años, que ya no dicen cómo está hoy.
 *
 * La mitad es el punto medio deliberado y fácil de explicar: al empezar la temporada
 * manda lo del año pasado (a media voz), y en cuanto se acumulan 5-6 partidos nuevos
 * la temporada en curso ya pesa más que toda la anterior junta.
 *
 * De DOS temporadas atrás en adelante no se cuenta nada: peso 0.
 */
export const PESO_TEMPORADA_ANTERIOR = 0.5

/**
 * Peso de un partido según su antigüedad en temporadas: 1 la actual, la mitad la
 * anterior, 0 el resto. Devuelve 0 también para los partidos con fecha FUTURA
 * respecto a `hoy` (no debería haberlos, pero un override de fecha mal puesto no
 * debe colarse como temporada "siguiente").
 */
function pesoPorTemporada(fecha: number, anioActual: number): number {
  const diff = anioActual - anioTemporada(fecha)
  if (diff === 0) return 1
  if (diff === 1) return PESO_TEMPORADA_ANTERIOR
  return 0
}

/**
 * Nota 0-10 de cada jugador SEGÚN SUS RESULTADOS, para el método de equilibrado
 * alternativo. Cada partido vale +1 si ganó, 0 si empató y -1 si perdió, y cuenta
 * con el peso de su temporada (ver `pesoPorTemporada`): la actual entera, la
 * anterior a la mitad, las demás nada.
 *
 *   media = (victorias - derrotas ponderadas) / (partidos ponderados + PARTIDOS_FANTASMA)
 *   nota  = 5 + 5 * media                                             →  0 .. 10
 *
 * Al ponderar TAMBIÉN el divisor (y no solo los puntos), los partidos viejos pierden
 * fuerza de forma coherente: diez victorias del año pasado cuentan como cinco, no
 * como diez victorias diluidas entre diez partidos.
 *
 * SE DEVUELVE EN ESCALA 0-10 A PROPÓSITO, la misma que las valoraciones. No es un
 * retoque de la métrica —es el mismo número en otras unidades y no cambia el orden
 * de nadie—, pero hace falta para que los términos SECUNDARIOS de la función de
 * coste sigan calibrados: líneas (0.4), zurdos (0.15) y repetición (0.3) están
 * pensados contra una diferencia de nivel en escala 0-10. Con la media cruda
 * (-1..+1) el reparto lo acabarían decidiendo ellos y no los resultados.
 *
 * Este método NO lleva el modificador de ánimo: reparte por lo que se gana en el
 * campo y nada más. Ver `resultadosScore` en `scoring.ts`.
 *
 * Quien no ha jugado ningún partido CONTABLE no aparece en el mapa; `playerScore` lo
 * trata como 5 (el centro), que es lo razonable: no hay nada que le suba ni que le
 * baje. Eso incluye al veterano que solo tiene partidos de hace dos temporadas.
 */
export function notasPorResultados(
  lineups: ConfirmedLineup[],
  hoy: Date = new Date(),
): Map<string, number> {
  // La temporada de referencia es la de HOY, no la del último partido registrado:
  // en septiembre, antes de la primera jornada, la actual ya es la nueva.
  const anioActual = anioTemporada(hoy.getTime())

  const balance = new Map<string, { puntos: number; partidos: number }>()
  const anotar = (id: string, delta: number, peso: number) => {
    const acc = balance.get(id) ?? { puntos: 0, partidos: 0 }
    acc.puntos += delta * peso
    acc.partidos += peso
    balance.set(id, acc)
  }

  for (const l of lineups) {
    const r = l.resultado
    if (!r) continue
    const peso = pesoPorTemporada(l.fecha, anioActual)
    if (peso === 0) continue
    const empate = r.golesA === r.golesB
    const ganaA = r.golesA > r.golesB
    // El empate no mueve los puntos pero SÍ cuenta como partido jugado: si no, no se
    // distingue a quien empata mucho de quien no ha venido, y su media se dispararía.
    for (const id of l.teamA) anotar(id, empate ? 0 : ganaA ? 1 : -1, peso)
    for (const id of l.teamB) anotar(id, empate ? 0 : ganaA ? -1 : 1, peso)
  }

  const notas = new Map<string, number>()
  for (const [id, { puntos, partidos }] of balance) {
    const media = puntos / (partidos + PARTIDOS_FANTASMA)
    notas.set(id, NOTA_NEUTRA + NOTA_NEUTRA * media)
  }
  return notas
}
