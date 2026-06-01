import { supabase } from './supabase'
import type { Player, ConfirmedLineup } from '../domain/types'

/**
 * Capa de acceso a datos en Supabase. Cada entidad se guarda como una fila con su
 * id (PK) y el objeto completo en `data` (jsonb). La lectura es pública; la escritura
 * requiere sesión de admin (lo impone RLS en la base de datos).
 */

// ---- Jugadores ----

export async function fetchPlayers(): Promise<Player[]> {
  const { data, error } = await supabase.from('players').select('data')
  if (error) throw error
  return (data ?? []).map((row) => row.data as Player)
}

export async function upsertPlayer(player: Player): Promise<void> {
  const { error } = await supabase
    .from('players')
    .upsert({ id: player.id, data: player, updated_at: new Date().toISOString() })
  if (error) throw error
}

export async function deletePlayer(id: string): Promise<void> {
  const { error } = await supabase.from('players').delete().eq('id', id)
  if (error) throw error
}

export async function upsertPlayers(players: Player[]): Promise<void> {
  if (players.length === 0) return
  const rows = players.map((p) => ({ id: p.id, data: p, updated_at: new Date().toISOString() }))
  const { error } = await supabase.from('players').upsert(rows)
  if (error) throw error
}

// ---- Alineaciones confirmadas ----

export async function fetchLineups(): Promise<ConfirmedLineup[]> {
  const { data, error } = await supabase.from('lineups').select('data')
  if (error) throw error
  return (data ?? []).map((row) => row.data as ConfirmedLineup)
}

export async function upsertLineup(lineup: ConfirmedLineup): Promise<void> {
  const { error } = await supabase
    .from('lineups')
    .upsert({ id: lineup.id, data: lineup, updated_at: new Date().toISOString() })
  if (error) throw error
}

export async function deleteLineup(id: string): Promise<void> {
  const { error } = await supabase.from('lineups').delete().eq('id', id)
  if (error) throw error
}

export async function upsertLineups(lineups: ConfirmedLineup[]): Promise<void> {
  if (lineups.length === 0) return
  const rows = lineups.map((l) => ({ id: l.id, data: l, updated_at: new Date().toISOString() }))
  const { error } = await supabase.from('lineups').upsert(rows)
  if (error) throw error
}
