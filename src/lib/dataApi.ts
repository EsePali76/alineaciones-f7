import { supabase } from './supabase'
import type { Player, PlayerRatings, Rating } from '../domain/types'
import type { ConfirmedLineup } from '../domain/types'

/**
 * Capa de acceso a datos en Supabase. Cada entidad se guarda como una fila con su
 * id (PK) y el objeto completo en `data` (jsonb). La lectura es pública; la escritura
 * requiere sesión de admin (lo impone RLS en la base de datos).
 */

// ---- Jugadores ----

/**
 * Migra un jugador del esquema de valoraciones antiguo al nuevo (v2):
 * - disparo → definicion, presion → defensa (renombrados).
 * - tecnica/velocidad/fisico se mantienen.
 * - forma y animo se descartan (forma eliminada; animo ahora es automático).
 * - "general" (ancla nueva): si no existe, se estima con la media de las facetas
 *   presentes para no perder continuidad con los datos ya metidos.
 * - Se asegura el flag nuevo `excluidoRotacion`.
 */
function normalizePlayer(raw: Player): Player {
  const r = (raw?.ratings ?? {}) as PlayerRatings & {
    disparo?: Rating
    presion?: Rating
  }

  const facetas: Partial<Record<keyof PlayerRatings, Rating | undefined>> = {
    definicion: r.definicion ?? r.disparo,
    criterio: r.criterio,
    tecnica: r.tecnica,
    defensa: r.defensa ?? r.presion,
    velocidad: r.velocidad,
    fisico: r.fisico,
  }

  let general = r.general
  if (general == null) {
    const present = Object.values(facetas).filter((v): v is number => typeof v === 'number')
    general = present.length
      ? Math.round(present.reduce((a, b) => a + b, 0) / present.length)
      : undefined
  }

  const ratings: PlayerRatings = {}
  if (general != null) ratings.general = general
  for (const [k, v] of Object.entries(facetas)) {
    if (typeof v === 'number') ratings[k as keyof PlayerRatings] = v
  }

  return {
    ...raw,
    ratings,
    excluidoRotacion: raw.excluidoRotacion ?? false,
    reserva: raw.reserva ?? false,
    activo: raw.activo ?? true,
    invitado: raw.invitado ?? false,
    habitual: raw.habitual ?? false,
    fotoOculta: raw.fotoOculta ?? false,
  }
}

export async function fetchPlayers(): Promise<Player[]> {
  const { data, error } = await supabase.from('players').select('data')
  if (error) throw error
  return (data ?? []).map((row) => normalizePlayer(row.data as Player))
}

export async function upsertPlayer(player: Player): Promise<void> {
  const { error } = await supabase
    .from('players')
    .upsert({ id: player.id, data: player, updated_at: new Date().toISOString() })
  if (error) throw error
}

/**
 * Actualiza un jugador EXISTENTE con UPDATE real (no upsert). Importante para RLS:
 * el upsert se evalúa como INSERT (solo admin), pero un UPDATE deja que el dueño
 * edite su propio jugador (política players_update).
 */
export async function updatePlayer(player: Player): Promise<void> {
  const { error } = await supabase
    .from('players')
    .update({ data: player, updated_at: new Date().toISOString() })
    .eq('id', player.id)
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
