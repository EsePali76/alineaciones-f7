// Modelo de dominio de alineaciones_F7

/** Códigos de posición en fútbol 7. Un jugador puede tener varias. */
export type PositionCode = 'POR' | 'DEF' | 'CAR' | 'MED' | 'MP' | 'EXT' | 'DEL'

/** Pierna hábil. */
export type Foot = 'izq' | 'der' | 'ambas'

/** Valoración numérica de 0 a 10 (enteros). */
export type Rating = number

/**
 * Valoraciones del jugador (1-5). Todas opcionales: si un parámetro está sin
 * rellenar (típico en invitados), el motor de equilibrado lo trata como 3 (media).
 */
export interface PlayerRatings {
  /** Técnica: control, regate, pase. */
  tecnica?: Rating
  /** Disparo: definición, finalización. */
  disparo?: Rating
  /** Presión: intensidad defensiva sin balón, robo, marca. */
  presion?: Rating
  velocidad?: Rating
  fisico?: Rating
  /** Estado de forma. De momento editable; a futuro retroalimentado por la racha. */
  forma?: Rating
  /** Estado de ánimo. De momento editable; a futuro derivado de victorias/derrotas. */
  animo?: Rating
}

export interface Player {
  id: string
  nombre: string
  /** Edad en años (dato objetivo, opcional). */
  edad?: number
  /** Posiciones que sabe jugar (al menos una). */
  posiciones: PositionCode[]
  pierna: Foot
  ratings: PlayerRatings
  /** Invitado / datos estimados: parámetros sin valorar se asumen a la media. */
  invitado: boolean
  /**
   * Tocado / en baja forma: juega con molestias o vuelve de lesión tras semanas sin
   * jugar. Condición puntual del día. El motor de equilibrado penalizará su puntaje.
   */
  tocado: boolean
  /** Si está en el plantel activo (false = dado de baja, no aparece para convocar). */
  activo: boolean
  createdAt: number
}

/**
 * Alineación confirmada por el admin un día concreto. Se guarda con los ids de
 * cada equipo para alimentar la lógica anti-repetición de futuras alineaciones.
 */
export interface ConfirmedLineup {
  id: string
  /** Timestamp del día de la alineación. */
  fecha: number
  /** Ids de jugadores del equipo A (⚪ blanco). */
  teamA: string[]
  /** Ids de jugadores del equipo B (🔴 rojo). */
  teamB: string[]
  /** Resultado del partido, si ya se ha registrado tras jugar. */
  resultado?: MatchResult
}

/** Marcador de un partido. golesA = equipo A (⚪), golesB = equipo B (🔴). */
export interface MatchResult {
  golesA: number
  golesB: number
}
