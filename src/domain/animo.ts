import type { ConfirmedLineup } from './types'

/**
 * Estado de ánimo AUTOMÁTICO (0-10), calculado de la racha de resultados.
 * - Base 5; victoria suma, derrota resta, empate no mueve.
 * - Suave (~1 punto por partido) y con decaimiento: los recientes pesan más.
 * - No se vota ni se edita: solo es visible. Afecta poco al puntaje (modificador ±0.3).
 */
const STEP = 1.0
const DECAY = 0.7
const BASE = 5

/** Resultado para un jugador en una alineación con marcador: 1 victoria / 0 empate / -1 derrota. */
function signoResultado(l: ConfirmedLineup, playerId: string): number | null {
  if (!l.resultado) return null
  const enA = l.teamA.includes(playerId)
  const enB = l.teamB.includes(playerId)
  if (!enA && !enB) return null
  const { golesA, golesB } = l.resultado
  if (golesA === golesB) return 0
  const gano = enA ? golesA > golesB : golesB > golesA
  return gano ? 1 : -1
}

/** Ánimo calculado (0-10) de un jugador a partir del historial con resultados. */
export function computeAnimo(playerId: string, lineups: ConfirmedLineup[]): number {
  const jugados = lineups
    .filter((l) => signoResultado(l, playerId) !== null)
    .sort((a, b) => b.fecha - a.fecha)
  let sum = 0
  jugados.forEach((l, i) => {
    sum += STEP * Math.pow(DECAY, i) * (signoResultado(l, playerId) ?? 0)
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
