-- ============================================================================
--  Migración incremental — restablecer contraseña (Admin → Usuarios)
--  El admin real pone una contraseña nueva a un usuario que ha olvidado la suya.
--  No toca nada más: misma cuenta, mismo email, mismos votos, mismo jugador.
--  El usuario puede cambiarla luego desde «Contraseña» en la barra de cuenta.
--  Ejecutar en Supabase → SQL Editor.
-- ============================================================================
create or replace function public.admin_set_password(target uuid, p_password text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_full_admin() then raise exception 'Solo admin'; end if;
  if p_password is null or length(p_password) < 6 then
    raise exception 'La contraseña debe tener al menos 6 caracteres';
  end if;
  update auth.users
     set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
         updated_at = now()
   where id = target;
  if not found then raise exception 'Usuario no encontrado'; end if;
end; $$;

revoke execute on function public.admin_set_password(uuid, text) from public, anon;
grant execute on function public.admin_set_password(uuid, text) to authenticated;
