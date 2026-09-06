import type { ConfirmedLineup } from './types'

/**
 * Mes (0-11) en que arranca una temporada de fútbol. Septiembre = 8: un partido de
 * septiembre en adelante cuenta para la temporada que empieza ese año; de enero a
 * agosto, para la que empezó el año anterior.
 */
const INICIO_TEMPORADA = 8

/** Valor especial del selector: agregado de todas las temporadas. */
export const TODAS = 'Totales'

/**
 * Año en que arranca la temporada a la que pertenece una fecha. Es la forma
 * NUMÉRICA de la temporada, para poder comparar dos (p.ej. "¿de cuántas temporadas
 * atrás es este partido?") sin andar parseando la etiqueta "25/26".
 */
export function anioTemporada(fecha: number): number {
  const d = new Date(fecha)
  return d.getMonth() >= INICIO_TEMPORADA ? d.getFullYear() : d.getFullYear() - 1
}

/** Etiqueta de temporada de una fecha, p.ej. "25/26". */
export function temporadaDe(fecha: number): string {
  const inicio = anioTemporada(fecha)
  const dd = (n: number) => String(((n % 100) + 100) % 100).padStart(2, '0')
  return `${dd(inicio)}/${dd(inicio + 1)}`
}

/** Temporadas presentes en el historial, de la más reciente a la más antigua. */
export function temporadasDisponibles(lineups: ConfirmedLineup[]): string[] {
  const set = new Set<string>()
  for (const l of lineups) set.add(temporadaDe(l.fecha))
  return [...set].sort((a, b) => b.localeCompare(a))
}

/** Filtra alineaciones por temporada. `TODAS` devuelve todas. */
export function filtrarPorTemporada(lineups: ConfirmedLineup[], temporada: string): ConfirmedLineup[] {
  if (temporada === TODAS) return lineups
  return lineups.filter((l) => temporadaDe(l.fecha) === temporada)
}
