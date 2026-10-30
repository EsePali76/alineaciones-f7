import type { ConfirmedLineup, Player } from './types'
import { playerScore, weightedRatings } from './scoring'
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
 *   real     = RESULTADO_POR_DIFERENCIA según los goles de diferencia (0,5 empate;
 *              el perdedor, 1 − lo del ganador)
 *   Δ        = K × (real − esperado), con límite: ganar nunca resta, perder nunca suma
 *   + BONUS_PARTIDO a todos
 *
 * Decisiones de Santi (2026-10-22):
 *  - Cuenta desde `AJUSTE_DESDE`: los partidos anteriores no mueven nada. Primero
 *    arrancaba el 2026-10-22; el 2026-10-23 el grupo decidió aplicarlo a toda la
 *    temporada 26/27 con K 0,35 (los partidos ya jugados llevan esa K guardada, ver
 *    `supabase/migration_ajuste_retroactivo.sql`).
 *  - 2026-10-29: el resultado pasa a valer por tramos de goles en vez de 1/0,5/0 ×
 *    factor de goles, para que una derrota ajustada en un partido igualado apenas
 *    mueva y la goleada pese por tramos. La K equivalente pasa de 0,35 a 0,70, también
 *    en los partidos ya jugados (`supabase/migration_ajuste_tramos.sql`).
 *  - K la configura el admin, y cada partido guarda la K vigente al registrar su
 *    resultado (`ConfirmedLineup.eloK`): cambiarla NO es retroactivo.
 *  - No se reinicia solo: lo pone a cero el admin (`Player.ajusteDesde`), en principio
 *    al empezar cada temporada (2026-10-29) o tras una revaloración. Lo de antes deja
 *    de sumar a la nota, pero sigue en `porTemporada` para Estadísticas.
 *  - Al principio, sin tope (el ELO se frena solo: al que baja, el equilibrador le
 *    pone mejores compañeros). Desde 2026-10-30, tope de ±2 y nota entre 4 y 10, como
 *    red de seguridad (ver `AJUSTE_MAX`).
 *
 * Calibrado con los 17 partidos que había: con K 0,5 los extremos se mueven ±1 punto
 * por temporada y la mayoría, ±0,5. Con los 9 primeros de la 26/27, K 0,5 movía ya
 * ±1 punto; con K 0,35 los extremos quedan en +0,7 / −1,0 (fórmula anterior).
 * Con los tramos y K 0,70, en un 55/45 ganar por 1 da ±0,04 al favorito y ±0,11 al
 * débil; por 3, ±0,14 / ±0,21; por 5 o más, ±0,25 / ±0,32.
 */

/** Primer día de partido que cuenta para el ajuste. */
export const AJUSTE_DESDE = '2026-09-01'

/** K inicial (hasta que el admin la cambie). */
export const K_DEFECTO = 0.7

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

/**
 * Límites (decisión de Santi, 2026-10-30): el ajuste no pasa de ±AJUSTE_MAX desde la
 * última puesta a cero (en principio, la temporada) y la nota (base + ajuste) no sale
 * de [NOTA_MIN, NOTA_MAX]. Al llegar al tope el ajuste deja de acumular en esa
 * dirección (sin «puntos invisibles» que remontar) y se vuelve a mover en cuanto el
 * resultado va en la otra. ±2 es lo que darían los extremos extrapolando la 26/27.
 */
export const AJUSTE_MAX = 2
export const NOTA_MIN = 4
export const NOTA_MAX = 10

/**
 * Diferencia de nivel medio (escala 0-10) que da un 10:1 de probabilidad. Se
 * compararon 2, 3, 4 y 5 con los 10 primeros partidos de la 26/27 (2026-10-30): los
 * cuatro aciertan casi igual; se queda en 2 toda la temporada para no recalcular.
 */
const ESCALA_ELO = 2

/** Probabilidad (0..1) de que gane el equipo de nivel medio `mediaA` contra `mediaB`. */
export function probabilidadVictoria(mediaA: number, mediaB: number): number {
  return 1 / (1 + 10 ** (-(mediaA - mediaB) / ESCALA_ELO))
}

/** Diferencia de nivel medio que corresponde a una probabilidad de victoria (inversa). */
export function diferenciaParaProbabilidad(prob: number): number {
  return ESCALA_ELO * Math.log10(prob / (1 - prob))
}

/** Probabilidad de victoria de cada equipo (0..1) a partir de sus jugadores. */
export function probabilidadEquipos(teamA: Player[], teamB: Player[]): number {
  if (!teamA.length || !teamB.length) return 0.5
  const media = (t: Player[]) => t.reduce((s, p) => s + playerScore(p), 0) / t.length
  return probabilidadVictoria(media(teamA), media(teamB))
}

/**
 * Lo que vale el resultado para el GANADOR según la diferencia de goles: índice 0 =
 * por 1 gol … índice 4 = por 5 o más. El perdedor se lleva 1 − eso; el empate, 0,5.
 */
const RESULTADO_POR_DIFERENCIA = [0.6, 0.68, 0.75, 0.82, 0.9]

/** Valor del resultado para el equipo A (0..1). */
function resultadoA(golesA: number, golesB: number): number {
  const dif = golesA - golesB
  if (dif === 0) return 0.5
  const ganador = RESULTADO_POR_DIFERENCIA[Math.min(Math.abs(dif), RESULTADO_POR_DIFERENCIA.length) - 1]
  return dif > 0 ? ganador : 1 - ganador
}

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

/** Lo que pasó en un partido según el ajuste (para la ficha del jugador y el historial). */
export interface PartidoAjuste {
  /** Nivel medio de cada equipo justo antes del partido (base + ajuste acumulado). */
  mediaA: number
  mediaB: number
  /** Probabilidad de victoria del equipo A (0..1). La del B es 1 − esta. */
  probA: number
  /** Solo en partidos con resultado que cuentan para el ajuste: */
  /** Δ de cada jugador, con el bonus y los límites ya aplicados. */
  delta?: Map<string, number>
  /** Nota de cada jugador justo después del partido (base + ajuste acumulado). */
  notaDespues?: Map<string, number>
}

export interface SimulacionAjustes {
  jugadores: Map<string, AjusteJugador>
  /** Por id de alineación: todas las que tienen los dos equipos, con o sin resultado. */
  partidos: Map<string, PartidoAjuste>
}

/** Ajuste de cada jugador (ver `simularAjustes`). */
export function calcularAjustes(
  lineups: ConfirmedLineup[],
  players: Player[],
  kActual: number,
  baseCincoDesde: number | null = null,
): Map<string, AjusteJugador> {
  return simularAjustes(lineups, players, kActual, baseCincoDesde).jugadores
}

/**
 * Recorre los partidos en orden y calcula el ajuste de cada jugador y el detalle de
 * cada partido. El nivel de cada equipo usa la valoración ACTUAL de cada jugador
 * más su ajuste acumulado hasta ese partido (las valoraciones de entonces no se
 * guardan; decisión de Santi, 2026-10-30: las valoraciones solo se reabren en agosto,
 * entre temporadas, así que dentro de una temporada la actual es la de todos sus
 * partidos). En los partidos desde `baseCincoDesde` (ms), la valoración se sustituye
 * por `BASE_COMUN`.
 *
 * Las alineaciones sin resultado (o anteriores a `AJUSTE_DESDE`) también salen en
 * `partidos`, con la probabilidad según el nivel de ese momento, pero no mueven nada.
 */
export function simularAjustes(
  lineups: ConfirmedLineup[],
  players: Player[],
  kActual: number,
  baseCincoDesde: number | null = null,
): SimulacionAjustes {
  const porId = new Map(players.map((p) => [p.id, p]))
  const res = new Map<string, AjusteJugador>()
  const partidos = new Map<string, PartidoAjuste>()
  // Acumulado de los partidos ANTERIORES a la puesta a cero: ya no suma a la nota,
  // pero da el nivel de esos partidos, para que el histórico salga igual que antes.
  const previo = new Map<string, number>()
  const anteriorAlCero = (id: string, fecha: number) => {
    const desde = porId.get(id)?.ajusteDesde
    return desde != null && fecha < desde
  }
  const acumulado = (id: string, fecha: number) =>
    anteriorAlCero(id, fecha) ? previo.get(id) ?? 0 : res.get(id)?.total ?? 0
  const base = (id: string, fecha: number) => {
    const p = porId.get(id)
    return baseCincoDesde != null && fecha >= baseCincoDesde ? BASE_COMUN : p ? weightedRatings(p) : 5
  }
  const nivel = (id: string, fecha: number) => base(id, fecha) + acumulado(id, fecha)
  const media = (ids: string[], fecha: number) =>
    ids.reduce((s, id) => s + nivel(id, fecha), 0) / ids.length

  const ordenados = lineups
    .filter((l) => l.teamA.length && l.teamB.length)
    .sort((a, b) => a.fecha - b.fecha)

  for (const l of ordenados) {
    const mediaA = media(l.teamA, l.fecha)
    const mediaB = media(l.teamB, l.fecha)
    const esperadoA = probabilidadVictoria(mediaA, mediaB)
    const partido: PartidoAjuste = { mediaA, mediaB, probA: esperadoA }
    partidos.set(l.id, partido)
    if (!l.resultado || !cuentaParaAjuste(l)) continue

    const { golesA, golesB } = l.resultado
    const bruto = (l.eloK ?? kActual) * (resultadoA(golesA, golesB) - esperadoA)
    // Límite: el muy favorito que gana por la mínima no resta, ni el muy débil que
    // pierde por la mínima suma (se queda en 0; el bonus sí lo cobran).
    const deltaA =
      golesA > golesB ? Math.max(0, bruto) : golesA < golesB ? Math.min(0, bruto) : bruto
    const temporada = temporadaDe(l.fecha)
    partido.delta = new Map()
    partido.notaDespues = new Map()

    const aplicar = (id: string, delta: number) => {
      const acc = res.get(id) ?? { total: 0, porTemporada: new Map<string, number>() }
      const antes = anteriorAlCero(id, l.fecha)
      const actual = antes ? previo.get(id) ?? 0 : acc.total
      // Topes: ±AJUSTE_MAX y la nota dentro de [NOTA_MIN, NOTA_MAX]. Solo frenan en la
      // dirección del movimiento: si alguien ya estuviera fuera (p. ej. porque cambió
      // su valoración), no se le hace saltar al tope de golpe.
      const b = base(id, l.fecha)
      const hi = Math.min(AJUSTE_MAX, NOTA_MAX - b)
      const lo = Math.max(-AJUSTE_MAX, NOTA_MIN - b)
      const sinTope = actual + delta + BONUS_PARTIDO
      const nuevo =
        sinTope > actual
          ? Math.max(actual, Math.min(sinTope, hi))
          : Math.min(actual, Math.max(sinTope, lo))
      const efectivo = nuevo - actual
      // El histórico por temporada cuenta siempre, para ver cómo acabó cada una.
      acc.porTemporada.set(temporada, (acc.porTemporada.get(temporada) ?? 0) + efectivo)
      // Puesto a cero por el admin después de este partido → no suma a su nota.
      if (antes) previo.set(id, nuevo)
      else acc.total = nuevo
      res.set(id, acc)
      partido.delta!.set(id, efectivo)
      partido.notaDespues!.set(id, b + nuevo)
    }
    for (const id of l.teamA) aplicar(id, deltaA)
    for (const id of l.teamB) aplicar(id, -deltaA)
  }
  return { jugadores: res, partidos }
}

/** Una fila de la tabla «¿Cómo se calcula el ajuste?». */
export interface FilaTablaAjuste {
  /** Texto del resultado desde el punto de vista del favorito. */
  resultado: string
  favorito: number
  debil: number
}

/**
 * Lo que gana o pierde el favorito y el débil, según el resultado, cuando el
 * favorito tiene `probFav` (0,5..1) de ganar. Misma cuenta que `simularAjustes`
 * (K, tramos de goles, límite de ganar/perder y bonus); sin los topes de ±2 y de la
 * nota, que dependen de cada jugador.
 */
export function tablaAjuste(probFav: number, k: number): FilaTablaAjuste[] {
  const delta = (real: number, esperado: number, gana: boolean | null) => {
    const bruto = k * (real - esperado)
    const limitado = gana === true ? Math.max(0, bruto) : gana === false ? Math.min(0, bruto) : bruto
    return limitado + BONUS_PARTIDO
  }
  const porGoles = (n: number) => (n >= RESULTADO_POR_DIFERENCIA.length ? `${n} o más` : `${n}`)
  const filas: FilaTablaAjuste[] = []
  // El favorito gana por 1..5+, empate, el favorito pierde por 1..5+.
  RESULTADO_POR_DIFERENCIA.forEach((w, i) =>
    filas.push({
      resultado: `Favorito gana por ${porGoles(i + 1)}`,
      favorito: delta(w, probFav, true),
      debil: delta(1 - w, 1 - probFav, false),
    }),
  )
  filas.push({ resultado: 'Empate', favorito: delta(0.5, probFav, null), debil: delta(0.5, 1 - probFav, null) })
  RESULTADO_POR_DIFERENCIA.forEach((w, i) =>
    filas.push({
      resultado: `Débil gana por ${porGoles(i + 1)}`,
      favorito: delta(1 - w, probFav, false),
      debil: delta(w, 1 - probFav, true),
    }),
  )
  return filas
}
