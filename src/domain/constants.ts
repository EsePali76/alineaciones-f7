import type { PositionCode, Foot, Rating } from './types'

/** Posiciones en orden de campo (defensa → ataque), con etiqueta legible. */
export const POSITIONS: { code: PositionCode; label: string; descripcion: string }[] = [
  { code: 'POR', label: 'Portero', descripcion: 'Bajo palos' },
  { code: 'DEF', label: 'Defensa', descripcion: 'Central' },
  { code: 'CAR', label: 'Carrilero', descripcion: 'Lateral / banda con ida y vuelta' },
  { code: 'MED', label: 'Mediocentro', descripcion: 'Centro del campo, posicional' },
  { code: 'MP', label: 'Mediapunta', descripcion: 'Enganche, móvil, con llegada' },
  { code: 'EXT', label: 'Extremo', descripcion: 'Banda ofensiva' },
  { code: 'DEL', label: 'Delantero', descripcion: 'Punta, finalizador' },
]

export const POSITION_LABEL: Record<PositionCode, string> = Object.fromEntries(
  POSITIONS.map((p) => [p.code, p.label]),
) as Record<PositionCode, string>

export const FOOT_OPTIONS: { value: Foot; label: string }[] = [
  { value: 'der', label: 'Derecha' },
  { value: 'izq', label: 'Izquierda' },
  { value: 'ambas', label: 'Ambidiestro' },
]

export const MIN_RATING = 0
export const MAX_RATING = 10

/** Etiqueta cualitativa orientativa para un valor de la escala 0-10. */
export function ratingLabel(v: number): string {
  if (v <= 2) return 'Pobre'
  if (v <= 4) return 'Justita'
  if (v <= 6) return 'Moderada'
  if (v <= 8) return 'Buena'
  return 'Excelente'
}

/** Valor por defecto cuando un parámetro no está valorado (la media de 0-10). */
export const DEFAULT_RATING: Rating = 5

/** Parámetros valorables, en orden de aparición en el formulario. */
export const RATING_KEYS = [
  'tecnica',
  'disparo',
  'presion',
  'velocidad',
  'fisico',
  'forma',
  'animo',
] as const
export type RatingKey = (typeof RATING_KEYS)[number]

export const RATING_KEY_LABEL: Record<RatingKey, string> = {
  tecnica: 'Técnica',
  disparo: 'Disparo',
  presion: 'Presión',
  velocidad: 'Velocidad',
  fisico: 'Físico',
  forma: 'Estado de forma',
  animo: 'Estado de ánimo',
}
