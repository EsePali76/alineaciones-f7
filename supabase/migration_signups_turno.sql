-- ============================================================================
--  Migración — Convocar a mano desde Equipos (el del turno, no solo el admin)
--  Ejecutar en el SQL Editor de Supabase. Idempotente.
--
--  Contexto: en la pestaña Equipos, quien hace la alineación (el del turno o el
--  admin) puede añadir convocados a mano (invitados o gente que no usa la app).
--  Para que esos convocados aparezcan en el banner para todos, se apuntan a la
--  convocatoria ('signups'). La RLS original solo dejaba escribir al admin o a la
--  propia fila, así que el del turno (no admin) no podía apuntar a otros.
--
--  Esta migración relaja insert/update/delete de 'signups' a cualquier miembro
--  vinculado (tiene player_id) o admin. Grupo de confianza; la UI mantiene los
--  límites (p.ej. solo el admin saca a quien se apuntó por la app). La lectura
--  sigue siendo pública. Para volver al modelo estricto, reaplica migration_signups.sql.
-- ============================================================================

drop policy if exists signups_insert on public.signups;
create policy signups_insert on public.signups for insert with check (
  public.is_admin() or public.my_player_id() is not null
);

drop policy if exists signups_update on public.signups;
create policy signups_update on public.signups for update
  using (public.is_admin() or public.my_player_id() is not null)
  with check (public.is_admin() or public.my_player_id() is not null);

drop policy if exists signups_delete on public.signups;
create policy signups_delete on public.signups for delete
  using (public.is_admin() or public.my_player_id() is not null);
