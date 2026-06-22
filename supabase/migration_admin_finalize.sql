-- ============================================================================
--  Migración — Cerrar/Reabrir valoraciones por jugador (admin)
--  Ejecutar en el SQL Editor de Supabase. Idempotente.
--
--  Hasta ahora un usuario solo quedaba bloqueado si EL MISMO pulsaba "Finalizar"
--  (ratings_finalized = true) y el plazo global estaba cerrado. Los que nunca
--  finalizaban seguían abiertos para siempre y el admin no podía cerrarlos.
--
--  Esta RPC permite al admin conmutar el flag de un usuario concreto:
--   - Cerrar  → ratings_finalized = true  (queda bloqueado, salvo plazo global abierto).
--   - Reabrir → ratings_finalized = false (equivale al admin_reset_ratings ya existente,
--               sin borrar sus votos).
--  Solo admin real (is_full_admin): vive en el menú Usuarios.
-- ============================================================================

create or replace function public.admin_set_ratings_finalized(target uuid, p_value boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_full_admin() then raise exception 'Solo admin'; end if;
  update public.profiles set ratings_finalized = p_value where id = target;
end; $$;

grant execute on function public.admin_set_ratings_finalized(uuid, boolean) to authenticated;
