import { supabase } from './supabase'
import type { RotationData } from '../domain/rotation'

interface RotationRow {
  id: number
  current_player_id: string | null
  order_ids: string[] | null
  skipped_ids: string[] | null
  ratings_open: boolean | null
  ratings_deadline: string | null
  require_ratings: boolean | null
  match_date: string | null
}

/** Estado de rotación + ventana de re-evaluación + override de fecha de partido. */
export interface RotationFetch {
  rotation: RotationData
  ratingsOpen: boolean
  /** Fecha límite del plazo de reevaluación ('YYYY-MM-DD'), o null si no tiene fin. */
  ratingsDeadline: string | null
  /** Filtro "solo alinea quien ha valorado a todos" activado. */
  requireRatings: boolean
  /** Override de fecha del próximo partido ('YYYY-MM-DD'), o null si automática. */
  matchDate: string | null
}

/** Lee el estado de rotación (fila singleton id=1) y el flag de ventana de revisión. */
export async function fetchRotation(): Promise<RotationFetch> {
  const { data, error } = await supabase
    .from('rotation')
    .select(
      'current_player_id, order_ids, skipped_ids, ratings_open, ratings_deadline, require_ratings, match_date',
    )
    .eq('id', 1)
    .maybeSingle()
  if (error) throw error
  const row = (data ?? {}) as Partial<RotationRow>
  return {
    rotation: {
      currentPlayerId: row.current_player_id ?? null,
      orderIds: row.order_ids ?? [],
      skippedIds: row.skipped_ids ?? [],
    },
    ratingsOpen: row.ratings_open ?? false,
    ratingsDeadline: row.ratings_deadline ?? null,
    requireRatings: row.require_ratings ?? false,
    matchDate: row.match_date ?? null,
  }
}

/** Fija (o limpia con null → automática) el override de fecha del próximo partido (admin). */
export async function saveMatchDate(matchDate: string | null): Promise<void> {
  const { error } = await supabase
    .from('rotation')
    .update({ match_date: matchDate, updated_at: new Date().toISOString() })
    .eq('id', 1)
  if (error) throw error
}

/** Abre/cierra la ventana global de re-evaluación (solo admin, vía RPC). */
export async function setRatingsOpen(open: boolean): Promise<void> {
  const { error } = await supabase.rpc('admin_set_ratings_open', { p_open: open })
  if (error) throw error
}

/** Fija (o quita con null) la fecha límite del plazo de reevaluación (solo admin). */
export async function setRatingsDeadline(fechaISO: string | null): Promise<void> {
  const { error } = await supabase.rpc('admin_set_ratings_deadline', { p_date: fechaISO })
  if (error) throw error
}

/** Activa/desactiva el filtro de valoraciones para la cola de alineadores (solo admin). */
export async function setRequireRatings(on: boolean): Promise<void> {
  const { error } = await supabase.rpc('admin_set_require_ratings', { p_on: on })
  if (error) throw error
}

/** Persiste el estado de rotación (requiere admin o ser el del turno actual; RLS). */
export async function saveRotation(data: RotationData): Promise<void> {
  const { error } = await supabase
    .from('rotation')
    .update({
      current_player_id: data.currentPlayerId,
      order_ids: data.orderIds,
      skipped_ids: data.skippedIds,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)
  if (error) throw error
}
