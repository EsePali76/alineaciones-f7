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
 *   Δ        = K × goles × (real − esperado) + BONUS_PARTIDO
 *
 * Decisiones de Santi (2026-10-22):
 *  - Cuenta desde `AJUSTE_DESDE`: los partidos anteriores no mueven nada. Primero
 *    arrancaba el 2026-10-22; el 2026-10-23 el grupo decidió aplicarlo a toda la
 *    temporada 26/27 con K 0,35 (los partidos ya jugados llevan esa K guardada, ver
 *    `supabase/migration_ajuste_retroactivo.sql`).
 *  - K la configura el admin, y cada partido guarda la K vigente al registrar su
 *    resultado (`ConfirmedLineup.eloK`): cambiarla NO es retroactivo.
 *  - No se reinicia solo: lo pone a cero el admin (`Player.ajusteDesde`), en principio
 *    al empezar cada temporada (2026-10-29) o tras una revaloración. Lo de antes deja
 *    de sumar a la nota, pero sigue en `porTemporada` para Estadísticas.
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

/**
 * Recompensa fija por partido jugado, gane o pierda (decisión de Santi, 2026-10-29).
 * Sutil a propósito: una derrota media resta ~0,20, así que hacen falta ~10 partidos
 * para compensarla. Va sumada dentro del ajuste, sin desglosar, y se va con él al
 * ponerlo a cero al empezar temporada. Cuenta en todos los partidos del ajuste.
 */
export const BONUS_PARTIDO = 0.02

/**
 * Nota de partida igual para todos con la opción «todos parten de 5» (la activa el
 * admin; decisión de Santi, 2026-10-29). Desde que se activa, la base del reparto y
 * del nivel de cada partido es esta en vez de la valoración del grupo, que se sigue
 * guardando y viendo para comparar. Los partidos anteriores no cambian.
 */
export const BASE_COMUN = 5

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
  /** Ajuste acumulado desde la última puesta a cero (lo que se suma a la valoración). */
  total: number
  /**
   * Lo ganado o perdido en cada temporada ('25/26' → Δ), para Estadísticas. Ignora
   * la puesta a cero: es el histórico de cómo acabó cada temporada.
   */
  porTemporada: Map<string, number>
}

/**
 * Ajuste de cada jugador, recorriendo los partidos en orden. El nivel de cada
 * equipo usa la valoración ACTUAL de cada jugador más su ajuste acumulado hasta ese
 * partido (las valoraciones de entonces no se guardan). En los partidos desde
 * `baseCincoDesde` (ms), la valoración se sustituye por `BASE_COMUN`.
 */
export function calcularAjustes(
  lineups: ConfirmedLineup[],
  players: Player[],
  kActual: number,
  baseCincoDesde: number | null = null,
): Map<string, AjusteJugador> {
  const porId = new Map(players.map((p) => [p.id, p]))
  const res = new Map<string, AjusteJugador>()
  // Acumulado de los partidos ANTERIORES a la puesta a cero: ya no suma a la nota,
  // pero da el nivel de esos partidos, para que el histórico salga igual que antes.
  const previo = new Map<string, number>()
  const anteriorAlCero = (id: string, fecha: number) => {
    const desde = porId.get(id)?.ajusteDesde
    return desde != null && fecha < desde
  }
  const acumulado = (id: string, fecha: number) =>
    anteriorAlCero(id, fecha) ? previo.get(id) ?? 0 : res.get(id)?.total ?? 0
  const nivel = (id: string, fecha: number) => {
    const p = porId.get(id)
    const base =
      baseCincoDesde != null && fecha >= baseCincoDesde ? BASE_COMUN : p ? weightedRatings(p) : 5
    return base + acumulado(id, fecha)
  }
  const media = (ids: string[], fecha: number) =>
    ids.reduce((s, id) => s + nivel(id, fecha), 0) / ids.length

  const jugados = lineups
    .filter((l) => l.resultado && cuentaParaAjuste(l) && l.teamA.length && l.teamB.length)
    .sort((a, b) => a.fecha - b.fecha)

  for (const l of jugados) {
    const { golesA, golesB } = l.resultado!
    const esperadoA = 1 / (1 + 10 ** (-(media(l.teamA, l.fecha) - media(l.teamB, l.fecha)) / ESCALA_ELO))
    const realA = golesA > golesB ? 1 : golesA < golesB ? 0 : 0.5
    const goles = 1 + FACTOR_GOLES * Math.min(Math.abs(golesA - golesB), MAX_DIF_GOLES)
    const deltaA = (l.eloK ?? kActual) * goles * (realA - esperadoA)
    const temporada = temporadaDe(l.fecha)

    const aplicar = (id: string, delta: number) => {
      const acc = res.get(id) ?? { total: 0, porTemporada: new Map<string, number>() }
      const conBonus = delta + BONUS_PARTIDO
      // El histórico por temporada cuenta siempre, para ver cómo acabó cada una.
      acc.porTemporada.set(temporada, (acc.porTemporada.get(temporada) ?? 0) + conBonus)
      // Puesto a cero por el admin después de este partido → no suma a su nota.
      if (anteriorAlCero(id, l.fecha)) previo.set(id, (previo.get(id) ?? 0) + conBonus)
      else acc.total += conBonus
      res.set(id, acc)
    }
    for (const id of l.teamA) aplicar(id, deltaA)
    for (const id of l.teamB) aplicar(id, -deltaA)
  }
  return res
}
