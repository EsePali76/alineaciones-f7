// Modelo de dominio de alineaciones_F7

/** Códigos de posición en fútbol 7. Un jugador puede tener varias. */
export type PositionCode = 'POR' | 'DEF' | 'CAR' | 'MED' | 'MP' | 'EXT' | 'DEL'

/** Pierna hábil. */
export type Foot = 'izq' | 'der' | 'ambas'

/** Valoración numérica de 0 a 10 (enteros). */
export type Rating = number

/**
 * Valoraciones del jugador (0-10). Todas opcionales: si un parámetro está sin
 * rellenar (típico en invitados), el motor de equilibrado lo trata como 5 (media).
 *
 * En el modelo colaborativo, estos valores representan la MEDIA de los votos del
 * resto de jugadores. "general" es el ancla holística y pondera bastante más.
 *
 * El estado de ánimo NO está aquí: no se vota, es automático (se calcula de la
 * racha de resultados) y entra como modificador suave aparte. El "estado de forma"
 * se eliminó (difícil de evaluar y cambia cada semana).
 */
export interface PlayerRatings {
  /** Valoración general (ancla): en conjunto, cómo de bueno es jugando al fútbol. */
  general?: Rating
  /** Definición: disparo, remate de cabeza. */
  definicion?: Rating
  /** Criterio con balón: pase, desmarque, visión de juego. */
  criterio?: Rating
  /** Técnica: control de balón, regate. */
  tecnica?: Rating
  /** Defensa: presión, anticipación, recuperación de balón. */
  defensa?: Rating
  /** Velocidad: sprint, velocidad punta. */
  velocidad?: Rating
  /** Físico: fuerza, resistencia. */
  fisico?: Rating
}

export interface Player {
  id: string
  nombre: string
  /** Edad en años (dato objetivo, opcional). */
  edad?: number
  /** Posiciones que sabe jugar (al menos una). */
  posiciones: PositionCode[]
  /** Perfil preferido (banda con la que actúa con naturalidad). Antes "pierna hábil". */
  pierna: Foot
  ratings: PlayerRatings
  /** Invitado / datos estimados: parámetros sin valorar se asumen a la media. */
  invitado: boolean
  /**
   * Tocado / bajo de forma: viene mermado a ESTE partido (molestias, vuelve de
   * lesión, etc.). Condición puntual del día que marca quien hace la alineación.
   * El motor de equilibrado penaliza su puntaje (~18%).
   */
  tocado: boolean
  /**
   * Excluido de la rotación de turnos: no entra en la cola para "hacer la
   * alineación" (viene poco, lesión larga, apartado…). NO impide ser convocado
   * para jugar. Lo marca el Admin o el propio usuario (autoexclusión).
   */
  excluidoRotacion: boolean
  /** Si está en el plantel activo (false = dado de baja, no aparece para convocar). */
  activo: boolean
  createdAt: number
  /**
   * Ánimo calculado (0-10) DERIVADO de los resultados. Campo transitorio: lo rellena
   * `useEffectivePlayers`; NO se persiste (los jugadores "crudos" del store no lo llevan).
   */
  animoCalculado?: number
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
  /** Id del jugador que hizo la alineación (el del turno). Para historial/estadísticas. */
  madeBy?: string
  /** Formación elegida por equipo (para dibujar el campo igual para todos). */
  formacionA?: string
  formacionB?: string
  /** Colocación manual (ids en orden de puesto), si se arrastraron fichas. */
  placementA?: string[]
  placementB?: string[]
  /** Resultado del partido, si ya se ha registrado tras jugar. */
  resultado?: MatchResult
}

/** Marcador de un partido. golesA = equipo A (⚪), golesB = equipo B (🔴). */
export interface MatchResult {
  golesA: number
  golesB: number
  /** Goles por jugador (playerId → nº de goles). Opcional. */
  goleadores?: Record<string, number>
  /** Asistencias por jugador (playerId → nº de asistencias). Opcional. */
  asistencias?: Record<string, number>
  /** MVP asignado a mano por el admin (playerId). Si está, manda sobre el automático. */
  mvp?: string
}
