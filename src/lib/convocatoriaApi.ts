import { supabase } from './supabase'

/** Estado de apuntado de un jugador a la convocatoria de una jornada. */
export type SignupStatus = 'in' | 'maybe'

export interface SignupRow {
  player_id: string
  /** 'in' = "Me apunto" (titular); 'maybe' = "Si falta gente voy" (reserva). */
  status: SignupStatus
  /** Jornada a la que pertenece este apunte ('YYYY-MM-DD'). */
  match_date: string
  /** Marca de tiempo: da el ORDEN DE LLEGADA dentro de la jornada. */
  created_at: string
}

/** Lee todos los apuntes (de todas las jornadas; el hook filtra por la actual). */
export async function fetchSignups(): Promise<SignupRow[]> {
  const { data, error } = await supabase
    .from('signups')
    .select('player_id, status, match_date, created_at')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as SignupRow[]
}

/**
 * Apunta (o cambia el estado de) un jugador a la jornada dada. Cada uno gestiona su
 * propia fila (RLS). Si la fila previa era de OTRA jornada, reinicia `created_at`
 * para que el orden de llegada empiece limpio esa semana; si solo cambia el estado
 * dentro de la misma jornada, conserva su sitio en la cola.
 */
export async function setSignup(
  playerId: string,
  status: SignupStatus,
  matchDate: string,
): Promise<void> {
  const { data } = await supabase
    .from('signups')
    .select('match_date')
    .eq('player_id', playerId)
    .maybeSingle()
  const fresh = !data || (data as { match_date: string }).match_date !== matchDate
  const row: Record<string, unknown> = { player_id: playerId, status, match_date: matchDate }
  // Solo fijamos created_at en alta/jornada nueva; en cambio de estado lo dejamos intacto.
  if (fresh) row.created_at = new Date().toISOString()
  const { error } = await supabase.from('signups').upsert(row)
  if (error) throw error
}

/** "Me borro": elimina el apunte del jugador. */
export async function deleteSignup(playerId: string): Promise<void> {
  const { error } = await supabase.from('signups').delete().eq('player_id', playerId)
  if (error) throw error
}
