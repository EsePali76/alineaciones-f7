-- ============================================================================
--  Migración incremental — borrar usuario (Admin → Usuarios)
--  Borra la CUENTA del usuario (auth.users). En cascada se eliminan su perfil
--  (profiles) y sus votos (ratings). El JUGADOR del plantel NO se toca.
--  Tras borrarlo, esa persona puede volver a registrarse con el mismo email.
--  Ejecutar en Supabase → SQL Editor.
-- ============================================================================
create or replace function public.admin_delete_user(target uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo admin'; end if;
  if target = auth.uid() then raise exception 'No puedes borrarte a ti mismo'; end if;
  -- Borrar la cuenta de Auth; profiles y ratings caen por ON DELETE CASCADE.
  delete from auth.users where id = target;
end; $$;

grant execute on function public.admin_delete_user(uuid) to authenticated;
