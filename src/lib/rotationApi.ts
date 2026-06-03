import { supabase } from './supabase'
import type { RotationData } from '../domain/rotation'

interface RotationRow {
  id: number
  current_player_id: string | null
  order_ids: string[] | null
  skipped_ids: string[] | null
  ratings_open: boolean | null
}

/** Estado de rotación + ventana global de re-evaluación de valoraciones. */
export interface RotationFetch {
  rotation: RotationData
  ratingsOpen: boolean
}

/** Lee el estado de rotación (fila singleton id=1) y el flag de ventana de revisión. */
export async function fetchRotation(): Promise<RotationFetch> {
  const { data, error } = await supabase
    .from('rotation')
    .select('current_player_id, order_ids, skipped_ids, ratings_open')
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
  }
}

/** Abre/cierra la ventana global de re-evaluación (solo admin, vía RPC). */
export async function setRatingsOpen(open: boolean): Promise<void> {
  const { error } = await supabase.rpc('admin_set_ratings_open', { p_open: open })
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
