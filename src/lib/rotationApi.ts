import { supabase } from './supabase'
import type { RotationData } from '../domain/rotation'

interface RotationRow {
  id: number
  current_player_id: string | null
  order_ids: string[] | null
  skipped_ids: string[] | null
}

/** Lee el estado de rotación (fila singleton id=1). */
export async function fetchRotation(): Promise<RotationData> {
  const { data, error } = await supabase
    .from('rotation')
    .select('current_player_id, order_ids, skipped_ids')
    .eq('id', 1)
    .maybeSingle()
  if (error) throw error
  const row = (data ?? {}) as Partial<RotationRow>
  return {
    currentPlayerId: row.current_player_id ?? null,
    orderIds: row.order_ids ?? [],
    skippedIds: row.skipped_ids ?? [],
  }
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
