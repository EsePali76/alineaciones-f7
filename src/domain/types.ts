// Modelo de dominio de alineaciones_F7

/**
 * Foto que debe MOSTRARSE de un jugador: su `fotoUrl`, salvo que el admin la haya
 * ocultado (`fotoOculta`), en cuyo caso devuelve `undefined` y el Avatar cae a la
 * silueta. Usar en todos los sitios donde se pinta el avatar (NO en el formulario
 * de edición, donde el admin necesita ver la foto real para decidir).
 */
export function fotoVisible(p?: Pick<Player, 'fotoUrl' | 'fotoOculta'> | null): string | undefined {
  return p && !p.fotoOculta ? p.fotoUrl : undefined
}

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
  /**
   * URL pública de la foto (avatar) en Supabase Storage. Opcional: sin foto se
   * muestra una silueta genérica. Lleva un `?v=<timestamp>` para forzar recarga al
   * cambiarla (la ruta del fichero se reutiliza). La sube cada usuario (la suya) o
   * el admin (cualquiera).
   */
  fotoUrl?: string
  /**
   * Foto oculta por el admin: si es `true`, la `fotoUrl` existe pero NO se muestra
   * en ningún sitio (se cae a la silueta genérica). Es la moderación reactiva para
   * cuando alguien sube una foto inapropiada. El admin sí ve la foto real en el
   * formulario de edición, para decidir. Por defecto `false` (la foto se ve).
   */
  fotoOculta?: boolean
  /**
   * Invitado: no es del grupo, no tiene cuenta de usuario. Vive en la lista de
   * Invitados (no en el Plantel) y nunca entra en la rotación de alineadores.
   * Parámetros sin valorar se asumen a la media.
   */
  invitado: boolean
  /**
   * Solo aplica a invitados (`invitado=true`):
   *  - `true`  → invitado HABITUAL: viene a menudo. Lo vota el grupo y cuenta en
   *    las estadísticas, como un jugador más (pero sin cuenta ni rotación).
   *  - `false` → invitado PUNTUAL: viene de un día. NO se vota (todos sus
   *    parámetros a la media 5, editables por el admin) y NO deja rastro en las
   *    estadísticas. Si pasa a habitual, basta con marcar este flag.
   * Irrelevante para jugadores del plantel (`invitado=false`).
   */
  habitual: boolean
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
  /**
   * Reserva: no es un fijo del grupo; viene como reserva habitual cuando no se
   * completan los 14 con los fijos. Sigue siendo convocable, pero NUNCA entra en
   * la rotación de alineadores (es menos habitual y no conoce bien al grupo).
   */
  reserva: boolean
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

/** Un gol concreto del partido: a qué equipo, quién lo metió y quién lo asistió. */
export interface GoalEvent {
  /** Equipo que marca: 'A' = ⚪ blanco, 'B' = 🔴 rojo. */
  equipo: 'A' | 'B'
  /** Goleador (playerId). Opcional: puede no recordarse quién marcó. */
  autor?: string
  /** Asistente (playerId), si lo hubo. */
  asistente?: string
}

/** Marcador de un partido. golesA = equipo A (⚪), golesB = equipo B (🔴). */
export interface MatchResult {
  golesA: number
  golesB: number
  /**
   * Goles del partido en orden, cada uno con autor y asistente. Fuente de verdad
   * del nuevo modelo: goleadores/asistencias se derivan de aquí (ver domain/result.ts).
   */
  goles?: GoalEvent[]
  /** [Legado] Goles por jugador (playerId → nº). Solo en partidos antiguos sin `goles`. */
  goleadores?: Record<string, number>
  /** [Legado] Asistencias por jugador (playerId → nº). Solo en partidos antiguos sin `goles`. */
  asistencias?: Record<string, number>
  /** MVP asignado a mano por el admin (playerId). Si está, manda sobre el automático. */
  mvp?: string
}
