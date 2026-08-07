import type { ConfirmedLineup } from './types'

/**
 * Método de ponderación con el que se equilibran los equipos.
 * - `valoraciones`: el de siempre. Media ponderada de lo que vota el grupo.
 * - `resultados`: solo lo que ha pasado en el campo (ver `puntosPorResultados`).
 * Se elige en la pantalla de Equipos antes de generar.
 */
export type MetodoEquilibrado = 'valoraciones' | 'resultados'

/**
 * Puntos de un jugador por sus resultados: +1 por victoria, 0 por empate, -1 por
 * derrota. Suma bruta de todo el historial con resultado registrado.
 *
 * OJO CON LA SUMA BRUTA: premia la asistencia, no solo el rendimiento. Quien viene
 * a 9 partidos y gana 5 sale +1; quien viene a 2 y gana los 2 sale +2, y no es
 * mejor jugador. Es la regla acordada a propósito (simple y explicable a todo el
 * mundo, que es medio objetivo del cambio). Si algún día chirría, la alternativa
 * es dividir por partidos jugados —media en vez de suma— y es una línea.
 */
export function puntosPorResultados(lineups: ConfirmedLineup[]): Map<string, number> {
  const puntos = new Map<string, number>()
  const sumar = (id: string, delta: number) => puntos.set(id, (puntos.get(id) ?? 0) + delta)

  for (const l of lineups) {
    const r = l.resultado
    if (!r) continue
    if (r.golesA === r.golesB) {
      // El empate no mueve la puntuación, pero el jugador debe APARECER en el mapa:
      // si no, no se distingue "empató todos" de "no ha jugado nunca".
      for (const id of [...l.teamA, ...l.teamB]) sumar(id, 0)
      continue
    }
    const ganaA = r.golesA > r.golesB
    for (const id of l.teamA) sumar(id, ganaA ? 1 : -1)
    for (const id of l.teamB) sumar(id, ganaA ? -1 : 1)
  }
  return puntos
}
