import type { ConfirmedLineup } from './types'

/**
 * Método de ponderación con el que se equilibran los equipos.
 * - `valoraciones`: el de siempre. Media ponderada de lo que vota el grupo.
 * - `resultados`: solo lo que ha pasado en el campo (ver `notasPorResultados`).
 * Se elige en la pantalla de Equipos antes de generar.
 */
export type MetodoEquilibrado = 'valoraciones' | 'resultados'

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
 * Nota 0-10 de cada jugador SEGÚN SUS RESULTADOS, para el método de equilibrado
 * alternativo. Cada partido vale +1 si ganó, 0 si empató y -1 si perdió.
 *
 *   media = (victorias - derrotas) / (partidos + PARTIDOS_FANTASMA)   → -1 .. +1
 *   nota  = 5 + 5 * media                                             →  0 .. 10
 *
 * SE DEVUELVE EN ESCALA 0-10 A PROPÓSITO, la misma que las valoraciones. Todo lo
 * que rodea al puntaje está calibrado para esa escala: el modificador de ánimo
 * (±0.5), la penalización por tocado y los pesos de líneas y zurdos de la función
 * de coste. Con la media cruda (-1..+1) el ánimo pasaría a pesar más que la propia
 * métrica y el reparto lo decidiría el modificador, no el criterio.
 *
 * Quien no ha jugado ningún partido no aparece en el mapa; `playerScore` lo trata
 * como 5 (el centro), que es lo razonable: no hay nada que le suba ni que le baje.
 */
export function notasPorResultados(lineups: ConfirmedLineup[]): Map<string, number> {
  const balance = new Map<string, { puntos: number; partidos: number }>()
  const anotar = (id: string, delta: number) => {
    const acc = balance.get(id) ?? { puntos: 0, partidos: 0 }
    acc.puntos += delta
    acc.partidos += 1
    balance.set(id, acc)
  }

  for (const l of lineups) {
    const r = l.resultado
    if (!r) continue
    const empate = r.golesA === r.golesB
    const ganaA = r.golesA > r.golesB
    // El empate no mueve los puntos pero SÍ cuenta como partido jugado: si no, no se
    // distingue a quien empata mucho de quien no ha venido, y su media se dispararía.
    for (const id of l.teamA) anotar(id, empate ? 0 : ganaA ? 1 : -1)
    for (const id of l.teamB) anotar(id, empate ? 0 : ganaA ? -1 : 1)
  }

  const notas = new Map<string, number>()
  for (const [id, { puntos, partidos }] of balance) {
    const media = puntos / (partidos + PARTIDOS_FANTASMA)
    notas.set(id, NOTA_NEUTRA + NOTA_NEUTRA * media)
  }
  return notas
}
