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

/**
 * Perfil preferido: indica en qué banda actúa con naturalidad (carrilero/extremo).
 * "Ambos" = cómodo en las dos bandas → la app puede colocarlo en cualquier lado.
 * (Internamente sigue siendo el campo `pierna` por compatibilidad de datos.)
 */
export const FOOT_OPTIONS: { value: Foot; label: string }[] = [
  { value: 'izq', label: 'Izquierdo' },
  { value: 'der', label: 'Derecho' },
  { value: 'ambas', label: 'Ambos' },
]

export const FOOT_LABEL: Record<Foot, string> = {
  izq: 'Izquierdo',
  der: 'Derecho',
  ambas: 'Ambos',
}

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

/**
 * Parámetros valorables (voto colaborativo), en orden de aparición.
 * "general" es el ancla holística y va destacado/separado en la UI.
 */
export const RATING_KEYS = [
  'general',
  'definicion',
  'criterio',
  'tecnica',
  'defensa',
  'velocidad',
  'fisico',
] as const
export type RatingKey = (typeof RATING_KEYS)[number]

/** Clave del parámetro ancla (pondera mucho más; se muestra destacado). */
export const RATING_KEY_ANCLA: RatingKey = 'general'

/** Facetas (todos los parámetros salvo el ancla), en orden. */
export const RATING_KEYS_FACETAS = RATING_KEYS.filter((k) => k !== RATING_KEY_ANCLA)

export const RATING_KEY_LABEL: Record<RatingKey, string> = {
  general: 'Valoración general',
  definicion: 'Definición',
  criterio: 'Criterio con balón',
  tecnica: 'Técnica',
  defensa: 'Defensa',
  velocidad: 'Velocidad',
  fisico: 'Físico',
}

/** Aclaración corta por parámetro (para alinear interpretaciones al valorar). */
export const RATING_KEY_HINT: Record<RatingKey, string> = {
  general: 'En conjunto, ¿cómo de bueno es jugando al fútbol? Pondera bastante más que el resto.',
  definicion: 'Disparo, remate de cabeza',
  criterio: 'Pase, desmarque, visión de juego',
  tecnica: 'Control de balón, regate',
  defensa: 'Presión, anticipación, recuperación de balón',
  velocidad: 'Sprint, velocidad punta',
  fisico: 'Fuerza, resistencia',
}
