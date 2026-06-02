import { supabase } from './supabase'
import type { PlayerRatings } from '../domain/types'
import { RATING_KEYS } from '../domain/constants'

/** Media de valoraciones de un jugador + nº de votos que la componen. */
export interface RatingAverage {
  numVotos: number
  values: PlayerRatings
}

interface AverageRow {
  player_id: string
  num_votos: number
  general: number | string | null
  definicion: number | string | null
  criterio: number | string | null
  tecnica: number | string | null
  defensa: number | string | null
  velocidad: number | string | null
  fisico: number | string | null
}

function num(v: number | string | null): number | undefined {
  if (v === null || v === undefined) return undefined
  const n = typeof v === 'string' ? Number(v) : v
  return Number.isFinite(n) ? n : undefined
}

/** Medias por jugador (vista pública `player_rating_averages`, sin identidad). */
export async function fetchRatingAverages(): Promise<Map<string, RatingAverage>> {
  const { data, error } = await supabase.from('player_rating_averages').select('*')
  if (error) throw error
  const map = new Map<string, RatingAverage>()
  for (const row of (data ?? []) as AverageRow[]) {
    const values: PlayerRatings = {}
    for (const k of RATING_KEYS) {
      const v = num(row[k])
      if (v !== undefined) values[k] = v
    }
    map.set(row.player_id, { numVotos: row.num_votos, values })
  }
  return map
}

/** Mis votos (rater = yo). Devuelve mapa jugadorValorado → valores. RLS solo deja ver los míos. */
export async function fetchMyRatings(myUserId: string): Promise<Map<string, PlayerRatings>> {
  const { data, error } = await supabase
    .from('ratings')
    .select('ratee_player_id, values')
    .eq('rater_id', myUserId)
  if (error) throw error
  const map = new Map<string, PlayerRatings>()
  for (const row of data ?? []) {
    map.set(row.ratee_player_id as string, (row.values ?? {}) as PlayerRatings)
  }
  return map
}

/** Guarda/actualiza mi voto a un jugador. */
export async function upsertMyRating(
  myUserId: string,
  rateePlayerId: string,
  values: PlayerRatings,
): Promise<void> {
  const { error } = await supabase.from('ratings').upsert({
    rater_id: myUserId,
    ratee_player_id: rateePlayerId,
    values,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

// ---- Admin: edición-proxy de un voto concreto de otro usuario ----

/** Votos de un usuario concreto (solo admin). Para la edición-proxy. */
export async function fetchRatingsOf(raterId: string): Promise<Map<string, PlayerRatings>> {
  const { data, error } = await supabase
    .from('ratings')
    .select('ratee_player_id, values')
    .eq('rater_id', raterId)
  if (error) throw error
  const map = new Map<string, PlayerRatings>()
  for (const row of data ?? []) {
    map.set(row.ratee_player_id as string, (row.values ?? {}) as PlayerRatings)
  }
  return map
}

/**
 * Admin edita "a ciegas" el voto de un usuario a un jugador (en su nombre).
 * Hace merge con lo existente para cambiar solo el/los parámetros indicados.
 */
export async function adminUpsertRating(
  raterId: string,
  rateePlayerId: string,
  values: PlayerRatings,
): Promise<void> {
  const { error } = await supabase.from('ratings').upsert({
    rater_id: raterId,
    ratee_player_id: rateePlayerId,
    values,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}
