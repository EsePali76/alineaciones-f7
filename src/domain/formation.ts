import type { ConfirmedLineup, Player, PositionCode } from './types'
import { playerScore } from './scoring'

export type FieldLine = 'POR' | 'DEF' | 'MED' | 'ATA'
type CampoLine = 'DEF' | 'MED' | 'ATA'

/** Línea de campo a la que pertenece cada posición. */
const LINEA_DE_POS: Record<PositionCode, FieldLine> = {
  POR: 'POR',
  DEF: 'DEF',
  CAR: 'DEF',
  MED: 'MED',
  MP: 'MED',
  EXT: 'ATA',
  DEL: 'ATA',
}

export interface Formacion {
  /** Etiqueta legible, p.ej. "1-3-2-1". */
  nombre: string
  /** Jugadores por equipo (incluye portero). */
  porEquipo: number
  /** Cupos de jugadores de campo por línea. */
  cupos: Record<CampoLine, number>
}

/** Catálogo de formaciones disponibles por nº de jugadores por equipo. */
export const FORMACIONES: Record<number, Formacion[]> = {
  6: [
    { nombre: '1-2-2-1', porEquipo: 6, cupos: { DEF: 2, MED: 2, ATA: 1 } },
    { nombre: '1-2-1-2', porEquipo: 6, cupos: { DEF: 2, MED: 1, ATA: 2 } },
    { nombre: '1-3-1-1', porEquipo: 6, cupos: { DEF: 3, MED: 1, ATA: 1 } },
  ],
  7: [
    { nombre: '1-3-2-1', porEquipo: 7, cupos: { DEF: 3, MED: 2, ATA: 1 } },
    { nombre: '1-2-3-1', porEquipo: 7, cupos: { DEF: 2, MED: 3, ATA: 1 } },
    { nombre: '1-3-1-2', porEquipo: 7, cupos: { DEF: 3, MED: 1, ATA: 2 } },
    { nombre: '1-2-2-2', porEquipo: 7, cupos: { DEF: 2, MED: 2, ATA: 2 } },
  ],
  8: [
    { nombre: '1-3-2-2', porEquipo: 8, cupos: { DEF: 3, MED: 2, ATA: 2 } },
    { nombre: '1-3-3-1', porEquipo: 8, cupos: { DEF: 3, MED: 3, ATA: 1 } },
    { nombre: '1-2-3-2', porEquipo: 8, cupos: { DEF: 2, MED: 3, ATA: 2 } },
    { nombre: '1-4-2-1', porEquipo: 8, cupos: { DEF: 4, MED: 2, ATA: 1 } },
  ],
}

export function formacionesDe(porEquipo: number): Formacion[] {
  return FORMACIONES[porEquipo] ?? []
}

/** Devuelve la formación por nombre, o la primera del formato si no se encuentra. */
export function formacionPorNombre(porEquipo: number, nombre: string): Formacion | undefined {
  const lista = formacionesDe(porEquipo)
  return lista.find((f) => f.nombre === nombre) ?? lista[0]
}

/** Línea preferida del jugador (su primera posición = la más cómoda). */
function lineaPreferida(p: Player): FieldLine {
  return LINEA_DE_POS[p.posiciones[0] ?? 'MED']
}

/** Líneas de campo en las que el jugador puede actuar, según TODAS sus posiciones. */
function lineasAptas(p: Player): CampoLine[] {
  const s = new Set<CampoLine>()
  for (const pos of p.posiciones) {
    const l = LINEA_DE_POS[pos]
    if (l !== 'POR') s.add(l)
  }
  return [...s]
}

export interface Asignacion {
  player: Player
  linea: FieldLine
}

/**
 * Balance de porterías de cada jugador: las veces que ha ido MENOS las que le
 * tocaban. Negativo = debe porterías; positivo = ya ha ido de más.
 *
 *   esperado = Σ 1/(tamaño de su equipo) por cada partido jugado
 *   balance  = veces que fue portero − esperado
 *
 * POR QUÉ NO EL RECUENTO BRUTO NI LA PROPORCIÓN. Con el recuento, al que lleva
 * pocos partidos le toca siempre (tiene pocas porterías por pura aritmética). Con
 * la proporción pasa exactamente lo mismo: un novato con 0 de 1 partido sale a
 * 0,00 y sigue siendo el más bajo. Restando lo que le tocaba, un fijo con 9
 * partidos y ninguna portería debe 1,29 y un novato de un día debe 0,14 — va antes
 * el fijo, que es lo justo. El tamaño del equipo se toma del partido concreto, así
 * que vale igual para 6v6 que para 8v8.
 *
 * De dónde sale quién fue portero: al confirmar se congela `placementA`/`placementB`
 * (ids en el orden en que se dibujan las fichas) y `ORDEN_BANDAS` empieza por 'POR',
 * así que **el primer id de cada placement es el portero de ese equipo**. Las
 * alineaciones sin placement se saltan ENTERAS (ni veces ni esperado): no se sabe
 * quién fue, y contarlas solo en el esperado inventaría deuda a quien sí fue.
 */
export function balancePorterias(lineups: ConfirmedLineup[]): Map<string, number> {
  const balance = new Map<string, number>()
  const suma = (id: string, delta: number) => balance.set(id, (balance.get(id) ?? 0) + delta)

  const contarEquipo = (ids: string[], placement?: string[]) => {
    const portero = placement?.[0]
    if (!portero || ids.length === 0) return
    const cuota = 1 / ids.length
    for (const id of ids) suma(id, id === portero ? 1 - cuota : -cuota)
  }

  for (const l of lineups) {
    contarEquipo(l.teamA, l.placementA)
    contarEquipo(l.teamB, l.placementB)
  }
  return balance
}

/**
 * Elige UN portero para el dibujo (cada equipo debe mostrar uno; en la pachanga se
 * turnan). Prioridad:
 *   1º posición preferida POR
 *   2º alguien que sepa jugar de POR
 *   3º el que MÁS porterías debe (ver `balancePorterias`); a igualdad, el de menor
 *      nivel, que es a quien menos penaliza ir a portería
 *
 * RETIRADO el criterio de "un tocado" (iba en 2º lugar): el flag ya no existe. En la
 * práctica la gente lo usaba para avisar de que ese día se ponía de portero, que es
 * otra cosa distinta y merecería su propia marca si se quiere recuperar.
 */
function elegirPortero(team: Player[], balance?: Map<string, number>): Player | null {
  if (team.length === 0) return null

  const porPreferida = team.find((p) => p.posiciones[0] === 'POR')
  if (porPreferida) return porPreferida

  const sabePortero = team.find((p) => p.posiciones.includes('POR'))
  if (sabePortero) return sabePortero

  // Menor balance = más porterías debe.
  const debe = (p: Player) => balance?.get(p.id) ?? 0
  return [...team].sort((a, b) => debe(a) - debe(b) || playerScore(a) - playerScore(b))[0]
}

/**
 * Asigna cada jugador a una línea según los cupos de la formación elegida,
 * respetando en lo posible su posición PREFERIDA (1ª marcada) y, si no cabe ahí,
 * colocándolo en otra línea que sepa jugar. Siempre coloca exactamente un portero.
 */
export function asignarFormacion(
  team: Player[],
  cupos: Record<CampoLine, number>,
  balancePortero?: Map<string, number>,
): Asignacion[] {
  const portero = elegirPortero(team, balancePortero)
  const campo = team.filter((p) => p !== portero)

  const restante: Record<CampoLine, number> = { ...cupos }
  const asignaciones: Asignacion[] = portero ? [{ player: portero, linea: 'POR' }] : []

  // 1ª pasada: cada jugador a su línea preferida si queda cupo (especialistas primero).
  const pendientes: Player[] = []
  const ordenados = [...campo].sort((a, b) => lineasAptas(a).length - lineasAptas(b).length)
  for (const p of ordenados) {
    const pref = lineaPreferida(p)
    if (pref !== 'POR' && restante[pref] > 0) {
      restante[pref]--
      asignaciones.push({ player: p, linea: pref })
    } else {
      pendientes.push(p)
    }
  }

  // 2ª pasada: los pendientes van SIEMPRE a una línea con cupo libre (la formación
  // manda y no se excede), preferiblemente una que sepan jugar; si ninguna apta tiene
  // cupo, a la que quede libre.
  const TODAS: CampoLine[] = ['DEF', 'MED', 'ATA']
  for (const p of pendientes) {
    const aptas = lineasAptas(p)
    const conCupo = TODAS.filter((l) => restante[l] > 0)
    const aptasConCupo = conCupo.filter((l) => aptas.includes(l))
    const candidatas = aptasConCupo.length > 0 ? aptasConCupo : conCupo
    const linea =
      [...candidatas].sort((a, b) => restante[b] - restante[a])[0] ??
      [...TODAS].sort((a, b) => restante[b] - restante[a])[0]
    restante[linea]--
    asignaciones.push({ player: p, linea })
  }

  return asignaciones
}
