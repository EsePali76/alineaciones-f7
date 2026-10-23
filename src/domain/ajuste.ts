import type { ConfirmedLineup, Player } from './types'
import { weightedRatings } from './scoring'
import { parseISO } from './matchday'
import { temporadaDe } from './season'

/**
 * AJUSTE POR RESULTADOS: lo que la nota de cada jugador sube o baja según los
 * partidos que gana o pierde. La nota con la que se reparte es
 *
 *   nota = valoración del grupo + ajuste
 *
 * Cada partido es un ELO por equipos: se calcula la probabilidad de ganar que
 * tenía cada equipo según el nivel medio de sus jugadores, y se reparte la
 * sorpresa. Ganar siendo el débil suma más que ganar siendo el favorito; perder
 * siendo el favorito resta más. Todos los del equipo reciben el mismo Δ.
 *
 *   esperado = 1 / (1 + 10^(-(nivel_mío − nivel_rival) / ESCALA_ELO))
 *   real     = 1 victoria · 0,5 empate · 0 derrota
 *   goles    = 1 + FACTOR_GOLES × min(diferencia, MAX_DIF_GOLES)
 *   Δ        = K × goles × (real − esperado)
 *
 * Decisiones de Santi (2026-10-22):
 *  - Cuenta desde `AJUSTE_DESDE`: los partidos anteriores no mueven nada. Primero
 *    arrancaba el 2026-10-22; el 2026-10-23 el grupo decidió aplicarlo a toda la
 *    temporada 26/27 con K 0,35 (los partidos ya jugados llevan esa K guardada, ver
 *    `supabase/migration_ajuste_retroactivo.sql`).
 *  - K la configura el admin, y cada partido guarda la K vigente al registrar su
 *    resultado (`ConfirmedLineup.eloK`): cambiarla NO es retroactivo.
 *  - No se reinicia por temporada (las valoraciones no se reabren cada año, así que
 *    el ajuste es lo que hace evolucionar la nota). Lo que sí puede hacer el admin es
 *    ponerlo a cero tras una revaloración (`Player.ajusteDesde`), para no contar dos
 *    veces una racha que el grupo ya ha tenido en cuenta al votar.
 *  - Sin tope: el ELO se frena solo (al que baja, el equilibrador le pone mejores
 *    compañeros y su probabilidad de ganar sube).
 *
 * Calibrado con los 17 partidos que había: con K 0,5 los extremos se mueven ±1 punto
 * por temporada y la mayoría, ±0,5. Con los 9 primeros de la 26/27, K 0,5 movía ya
 * ±1 punto; con K 0,35 los extremos quedan en +0,7 / −1,0.
 */

/** Primer día de partido que cuenta para el ajuste. */
export const AJUSTE_DESDE = '2026-09-01'

/** K inicial (hasta que el admin la cambie). */
export const K_DEFECTO = 0.3

/** Diferencia de nivel medio (escala 0-10) que da un 10:1 de probabilidad. */
const ESCALA_ELO = 2

/** Cada gol de diferencia multiplica el Δ por +10 %, hasta 5 goles (×1,5). */
const FACTOR_GOLES = 0.1
const MAX_DIF_GOLES = 5

const desdeMs = parseISO(AJUSTE_DESDE).getTime()

/** ¿Este partido entra en el ajuste? (Por su día de partido.) */
export function cuentaParaAjuste(lineup: ConfirmedLineup): boolean {
  return lineup.fecha >= desdeMs
}

/**
 * K a guardar en un partido al registrar su resultado: la que ya tuviera (editar
 * un resultado no le cambia la K) o la vigente, si el partido cuenta.
 */
export function kAlRegistrar(lineup: ConfirmedLineup, kActual: number): number | undefined {
  return lineup.eloK ?? (cuentaParaAjuste(lineup) ? kActual : undefined)
}

export interface AjusteJugador {
  /** Ajuste acumulado (lo que se suma a la valoración). */
  total: number
  /** Lo ganado o perdido en cada temporada ('25/26' → Δ), para Estadísticas. */
  porTemporada: Map<string, number>
}

/**
 * Ajuste de cada jugador, recorriendo los partidos en orden. El nivel de cada
 * equipo usa la valoración ACTUAL de cada jugador más su ajuste acumulado hasta ese
 * partido (las valoraciones de entonces no se guardan).
 */
export function calcularAjustes(
  lineups: ConfirmedLineup[],
  players: Player[],
  kActual: number,
): Map<string, AjusteJugador> {
  const porId = new Map(players.map((p) => [p.id, p]))
  const res = new Map<string, AjusteJugador>()
  const total = (id: string) => res.get(id)?.total ?? 0
  const nivel = (id: string) => {
    const p = porId.get(id)
    return (p ? weightedRatings(p) : 5) + total(id)
  }
  const media = (ids: string[]) => ids.reduce((s, id) => s + nivel(id), 0) / ids.length

  const jugados = lineups
    .filter((l) => l.resultado && cuentaParaAjuste(l) && l.teamA.length && l.teamB.length)
    .sort((a, b) => a.fecha - b.fecha)

  for (const l of jugados) {
    const { golesA, golesB } = l.resultado!
    const esperadoA = 1 / (1 + 10 ** (-(media(l.teamA) - media(l.teamB)) / ESCALA_ELO))
    const realA = golesA > golesB ? 1 : golesA < golesB ? 0 : 0.5
    const goles = 1 + FACTOR_GOLES * Math.min(Math.abs(golesA - golesB), MAX_DIF_GOLES)
    const deltaA = (l.eloK ?? kActual) * goles * (realA - esperadoA)
    const temporada = temporadaDe(l.fecha)

    const aplicar = (id: string, delta: number) => {
      // Puesto a cero por el admin después de este partido → no cuenta para él.
      const desde = porId.get(id)?.ajusteDesde
      if (desde != null && l.fecha < desde) return
      const acc = res.get(id) ?? { total: 0, porTemporada: new Map<string, number>() }
      acc.total += delta
      acc.porTemporada.set(temporada, (acc.porTemporada.get(temporada) ?? 0) + delta)
      res.set(id, acc)
    }
    for (const id of l.teamA) aplicar(id, deltaA)
    for (const id of l.teamB) aplicar(id, -deltaA)
  }
  return res
}
