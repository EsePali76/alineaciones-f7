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
 * Cuántas veces ha ido de portero cada jugador, según el historial confirmado.
 *
 * De dónde sale: al confirmar una alineación se congela `placementA`/`placementB`
 * (ids en el orden en que se dibujan las fichas), y `ORDEN_BANDAS` empieza por
 * 'POR' — así que **el primer id de cada placement es el portero de ese equipo**.
 * Las alineaciones antiguas sin placement se saltan: no hay forma de saberlo.
 */
export function vecesDePortero(lineups: ConfirmedLineup[]): Map<string, number> {
  const veces = new Map<string, number>()
  const contar = (placement?: string[]) => {
    const portero = placement?.[0]
    if (portero) veces.set(portero, (veces.get(portero) ?? 0) + 1)
  }
  for (const l of lineups) {
    contar(l.placementA)
    contar(l.placementB)
  }
  return veces
}

/**
 * Elige UN portero para el dibujo (cada equipo debe mostrar uno; en la pachanga se
 * turnan). Prioridad:
 *   1º posición preferida POR
 *   2º alguien que sepa jugar de POR
 *   3º el que MENOS veces ha ido de portero (turno rotativo de hecho); a igualdad,
 *      el de menor nivel, que es a quien menos penaliza ir a portería
 *
 * RETIRADO el criterio de "un tocado" (iba en 2º lugar): el flag ya no existe. En la
 * práctica la gente lo usaba para avisar de que ese día se ponía de portero, que es
 * otra cosa distinta y merecería su propia marca si se quiere recuperar.
 *
 * OJO con el 3º: es un recuento BRUTO, así que quien lleva pocos partidos en el
 * grupo tiene pocas porterías por pura aritmética y le tocará antes. Si eso molesta,
 * la alternativa es la proporción sobre partidos jugados.
 */
function elegirPortero(team: Player[], vecesPortero?: Map<string, number>): Player | null {
  if (team.length === 0) return null

  const porPreferida = team.find((p) => p.posiciones[0] === 'POR')
  if (porPreferida) return porPreferida

  const sabePortero = team.find((p) => p.posiciones.includes('POR'))
  if (sabePortero) return sabePortero

  const veces = (p: Player) => vecesPortero?.get(p.id) ?? 0
  return [...team].sort(
    (a, b) => veces(a) - veces(b) || playerScore(a) - playerScore(b),
  )[0]
}

/**
 * Asigna cada jugador a una línea según los cupos de la formación elegida,
 * respetando en lo posible su posición PREFERIDA (1ª marcada) y, si no cabe ahí,
 * colocándolo en otra línea que sepa jugar. Siempre coloca exactamente un portero.
 */
export function asignarFormacion(
  team: Player[],
  cupos: Record<CampoLine, number>,
  vecesPortero?: Map<string, number>,
): Asignacion[] {
  const portero = elegirPortero(team, vecesPortero)
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
