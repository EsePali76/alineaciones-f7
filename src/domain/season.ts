import type { ConfirmedLineup } from './types'

/**
 * Mes (0-11) en que arranca una temporada de fútbol. Septiembre = 8: un partido de
 * septiembre en adelante cuenta para la temporada que empieza ese año; de enero a
 * agosto, para la que empezó el año anterior.
 */
const INICIO_TEMPORADA = 8

/** Valor especial del selector: agregado de todas las temporadas. */
export const TODAS = 'Totales'

/** Etiqueta de temporada de una fecha, p.ej. "25/26". */
export function temporadaDe(fecha: number): string {
  const d = new Date(fecha)
  const inicio = d.getMonth() >= INICIO_TEMPORADA ? d.getFullYear() : d.getFullYear() - 1
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
