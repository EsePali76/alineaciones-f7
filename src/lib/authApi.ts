import { supabase } from './supabase'

/**
 * Perfil de usuario (tabla `profiles`). 1 fila por usuario de Supabase Auth,
 * vinculado a un jugador del plantel por el Admin.
 */
export interface Profile {
  id: string
  email: string | null
  displayName: string | null
  /**
   * 'admin' = todo; 'superuser' = privilegios operativos del admin MENOS el menú
   * Usuarios (gestión de cuentas, proxy de votos, plazo de reevaluación); 'player' = jugador.
   */
  role: 'admin' | 'superuser' | 'player'
  /** Jugador del plantel al que está vinculado (null = sin vincular). */
  playerId: string | null
  /** true cuando finalizó (y bloqueó) sus valoraciones. */
  ratingsFinalized: boolean
}

interface ProfileRow {
  id: string
  email: string | null
  display_name: string | null
  role: 'admin' | 'superuser' | 'player'
  player_id: string | null
  ratings_finalized: boolean
}

function toProfile(r: ProfileRow): Profile {
  return {
    id: r.id,
    email: r.email,
    displayName: r.display_name,
    role: r.role,
    playerId: r.player_id,
    ratingsFinalized: r.ratings_finalized,
  }
}

const COLS = 'id, email, display_name, role, player_id, ratings_finalized'

/** Perfil del usuario indicado (normalmente el propio: RLS solo deja ver el tuyo). */
export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select(COLS).eq('id', userId).maybeSingle()
  if (error) throw error
  return data ? toProfile(data as ProfileRow) : null
}

/** Todos los perfiles (solo admin los ve por RLS). Para el panel de Usuarios. */
export async function fetchAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select(COLS)
  if (error) throw error
  return (data ?? []).map((r) => toProfile(r as ProfileRow))
}

// ---- RPCs (mutaciones sensibles; validan admin en el servidor) ----

/** Admin: vincula (o desvincula con null) un usuario a un jugador. */
export async function adminLinkPlayer(target: string, playerId: string | null): Promise<void> {
  const { error } = await supabase.rpc('admin_link_player', {
    target,
    p_player_id: playerId,
  })
  if (error) throw error
}

/** Admin: cambia el rol de un usuario. */
export async function adminSetRole(
  target: string,
  role: 'admin' | 'superuser' | 'player',
): Promise<void> {
  const { error } = await supabase.rpc('admin_set_role', { target, new_role: role })
  if (error) throw error
}

/** Admin: resetea el proceso de valoración (desbloquea para rehacerlo). */
export async function adminResetRatings(target: string): Promise<void> {
  const { error } = await supabase.rpc('admin_reset_ratings', { target })
  if (error) throw error
}

/**
 * Admin: cierra (true) o reabre (false) las valoraciones de un usuario concreto.
 * Cerrar = bloquearlas aunque el usuario no pulsara "Finalizar"; reabrir = desbloquear
 * sin borrar sus votos.
 */
export async function adminSetRatingsFinalized(
  target: string,
  value: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('admin_set_ratings_finalized', {
    target,
    p_value: value,
  })
  if (error) throw error
}

/** El propio usuario finaliza (bloquea) sus valoraciones. */
export async function finalizeMyRatings(): Promise<void> {
  const { error } = await supabase.rpc('finalize_my_ratings')
  if (error) throw error
}

/** Admin: borra la cuenta de un usuario (cascada perfil + votos; el jugador se mantiene). */
export async function adminDeleteUser(target: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_user', { target })
  if (error) throw error
}
